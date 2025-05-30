/**
 * 📡 Frame Decoder pour OBD NR-B80
 * 
 * Décodeur de trames basé sur l'analyse du protocole du code Java original
 * Format: [Header][Device ID][Command][Length][Data][Checksum][Tail]
 */

const logger = require('../utils/logger');

class FrameDecoder {
    constructor() {
        this.PROTOCOL_HEADER = 0x24; // $
        this.PROTOCOL_TAIL = 0x0D;   // \r
        this.MIN_FRAME_LENGTH = 11;   // Longueur minimale d'une trame
    }

    /**
     * Extrait une trame complète du buffer de données
     */
    extractFrame(buffer) {
        try {
            if (buffer.length < this.MIN_FRAME_LENGTH) {
                return { success: false, reason: 'buffer_too_small' };
            }

            // Rechercher l'en-tête
            let headerIndex = -1;
            for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === this.PROTOCOL_HEADER) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex === -1) {
                return { success: false, reason: 'no_header_found' };
            }

            // Vérifier qu'on a assez de données pour lire la longueur
            if (buffer.length < headerIndex + 11) {
                return { success: false, reason: 'incomplete_header' };
            }

            // Lire la longueur de la charge utile (bytes 9-10)
            const lengthBytes = buffer.subarray(headerIndex + 9, headerIndex + 11);
            const payloadLength = parseInt(this.bytesToHex(lengthBytes), 16);

            // Calculer la longueur totale de la trame
            const totalLength = headerIndex + 11 + payloadLength + 2; // +2 pour checksum et tail

            if (buffer.length < totalLength) {
                return { success: false, reason: 'incomplete_frame' };
            }

            // Extraire la trame complète
            const frame = buffer.subarray(headerIndex, totalLength);

            // Vérifier l'intégrité avec le checksum
            if (!this.validateChecksum(frame)) {
                logger.warn('Checksum invalide pour la trame');
                // Retourner quand même la trame pour debug, mais marquer comme invalide
            }

            return {
                success: true,
                frame,
                bytesConsumed: totalLength
            };

        } catch (error) {
            logger.error('Erreur extraction trame:', error);
            return { success: false, reason: 'decode_error' };
        }
    }

    /**
     * Décode une trame en structure de données
     */
    decode(frame) {
        try {
            if (frame.length < this.MIN_FRAME_LENGTH) {
                return null;
            }

            // Décoder l'échappement des caractères spéciaux (comme dans le code Java)
            const unescapedFrame = this.unescapeFrame(frame);

            const result = {
                header: unescapedFrame[0],
                deviceId: this.bytesToHex(unescapedFrame.subarray(1, 7)),
                command: this.bytesToHex(unescapedFrame.subarray(7, 9)),
                length: this.bytesToHex(unescapedFrame.subarray(9, 11)),
                rawFrame: frame,
                timestamp: new Date().toISOString()
            };

            // Extraire les données selon la longueur
            const dataLength = parseInt(result.length, 16);
            if (dataLength > 0 && unescapedFrame.length >= 11 + dataLength) {
                result.data = unescapedFrame.subarray(11, 11 + dataLength);
                result.checksum = unescapedFrame[11 + dataLength];
                result.tail = unescapedFrame[11 + dataLength + 1];
            }

            return result;

        } catch (error) {
            logger.error('Erreur décodage trame:', error);
            return null;
        }
    }

    /**
     * Unescape des caractères spéciaux (basé sur le code Java FrameDecode.framedecode)
     */
    unescapeFrame(frame) {
        try {
            let result = Buffer.from(frame);
            
            // Traitement de l'échappement 0x3D (comme dans le code Java)
            for (let i = 1; i < result.length - 1; i++) {
                if (result[i] === 0x3D && i + 1 < result.length) {
                    // XOR avec le byte suivant
                    result[i] = result[i] ^ result[i + 1];
                    // Supprimer le byte suivant
                    result = this.deleteBytes(result, i + 1, 1);
                }
            }

            return result;
        } catch (error) {
            logger.error('Erreur unescape trame:', error);
            return frame;
        }
    }

    /**
     * Validation du checksum (XOR de tous les bytes sauf header et checksum)
     */
    validateChecksum(frame) {
        try {
            if (frame.length < this.MIN_FRAME_LENGTH) {
                return false;
            }

            const dataLength = parseInt(this.bytesToHex(frame.subarray(9, 11)), 16);
            const checksumIndex = 11 + dataLength;
            
            if (frame.length <= checksumIndex) {
                return false;
            }

            // Calculer checksum (XOR des bytes 1 à checksumIndex-1)
            let calculatedChecksum = frame[1];
            for (let i = 2; i < checksumIndex; i++) {
                calculatedChecksum ^= frame[i];
            }

            const frameChecksum = frame[checksumIndex];
            return calculatedChecksum === frameChecksum;

        } catch (error) {
            logger.error('Erreur validation checksum:', error);
            return false;
        }
    }

    /**
     * Convertit des bytes en chaîne hexadécimale
     */
    bytesToHex(bytes) {
        return Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Convertit une chaîne hex en bytes
     */
    hexToBytes(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return Buffer.from(bytes);
    }

    /**
     * Supprime des bytes d'un buffer
     */
    deleteBytes(buffer, index, count) {
        const result = Buffer.alloc(buffer.length - count);
        buffer.copy(result, 0, 0, index);
        buffer.copy(result, index, index + count);
        return result;
    }

    /**
     * Extrait une sous-séquence de bytes
     */
    subBytes(buffer, start, length) {
        return buffer.subarray(start, start + length);
    }

    /**
     * Convertit des bytes en entier
     */
    bytesToInt(bytes, base = 16) {
        return parseInt(this.bytesToHex(bytes), base);
    }

    /**
     * Format une date à partir des bytes (jour, mois, année)
     */
    formatDate(dayByte, monthByte, yearByte) {
        const day = dayByte;
        const month = monthByte;
        const year = 2000 + yearByte; // Assumant que l'année est relative à 2000
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }

    /**
     * Format une heure à partir des bytes (heure, minute, seconde) avec correction UTC+8
     */
    formatTime(hourByte, minuteByte, secondByte, adjustTimezone = true) {
        let hour = hourByte;
        const minute = minuteByte;
        const second = secondByte;
        
        // Ajustement timezone (Beijing time +8)
        if (adjustTimezone) {
            hour += 8;
            if (hour >= 24) {
                hour -= 24;
            }
        }
        
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
    }

    /**
     * Décode les coordonnées GPS
     */
    decodeGPSCoordinates(latBytes, lonBytes, bitIdentifier) {
        try {
            // Latitude (basé sur le code Java)
            const latDegree = latBytes[0];
            const latMinuteBytes = latBytes.subarray(1, 4);
            const latMinuteToDegree = parseInt(this.bytesToHex(latMinuteBytes), 10) * 0.0001 / 60;
            let latitude = latDegree + latMinuteToDegree;

            // Longitude
            const lonData = this.bytesToHex(lonBytes);
            const lonDegree = parseInt(lonData.substring(0, 3), 10);
            const lonMinute = lonData.substring(3, 9);
            const lonMinuteToDegree = parseInt(lonMinute, 10) * 0.0001 / 60;
            let longitude = lonDegree + lonMinuteToDegree;

            // Application des directions basées sur bitIdentifier
            const bits = bitIdentifier.toString(2).padStart(4, '0');
            if (bits[1] === '0') latitude = -latitude;  // S
            if (bits[2] === '0') longitude = -longitude; // W

            return {
                latitude: parseFloat(latitude.toFixed(5)),
                longitude: parseFloat(longitude.toFixed(7))
            };
        } catch (error) {
            logger.error('Erreur décodage GPS:', error);
            return { latitude: 0, longitude: 0 };
        }
    }
}

module.exports = FrameDecoder; 