/**
 * 🔧 OBD Decoder pour NR-B80
 * 
 * Décodeur spécialisé pour les données OBD basé sur l'analyse du code Java original
 * Support de toutes les commandes: 3080, 3089, 308a, 308b, etc.
 */

const logger = require('../utils/logger');
const FrameDecoder = require('./frameDecoder');

class OBDDecoder {
    constructor() {
        this.frameDecoder = new FrameDecoder();
        this.commandHandlers = {
            '3080': this.decodeGPSOBDData.bind(this),
            '3089': this.decodeIgnitionFlameoutReport.bind(this),
            '308a': this.decodeOBDDataQuery.bind(this),
            '308b': this.decodeAverageFuelQuery.bind(this),
            '0008': this.decodeAlarmConfirmation.bind(this),
            '0081': this.decodeManufacturer.bind(this),
            '0082': this.decodeSoftwareVersion.bind(this),
            '0083': this.decodeDeviceID.bind(this),
            '0084': this.decodeFactoryReset.bind(this),
            '0085': this.decodeDeviceRestart.bind(this)
        };
    }

    async decode(decodedFrame) {
        try {
            const command = decodedFrame.command;
            const handler = this.commandHandlers[command];

            if (!handler) {
                logger.warn(`Commande OBD non supportée: ${command}`);
                return null;
            }

            const result = await handler(decodedFrame);
            
            if (result) {
                result.deviceId = decodedFrame.deviceId;
                result.command = command;
                result.timestamp = decodedFrame.timestamp;
                result.raw = this.frameDecoder.bytesToHex(decodedFrame.rawFrame);
            }

            return result;

        } catch (error) {
            logger.error(`Erreur décodage OBD command ${decodedFrame.command}:`, error);
            return null;
        }
    }

    /**
     * Commande 3080: Données GPS + OBD combinées (la plus importante)
     */
    async decodeGPSOBDData(frame) {
        try {
            if (!frame.data || frame.data.length < 50) {
                logger.warn('Données GPS+OBD insuffisantes');
                return null;
            }

            const data = frame.data;
            
            // Type de données (byte 0)
            const dataType = data[0];
            
            // ID de voyage (bytes 1-2)
            const tripId = this.frameDecoder.bytesToInt(data.subarray(1, 3));
            
            // Date et heure (bytes 3-8)
            const day = data[3];
            const month = data[4];
            const year = 2000 + data[5];
            let hour = data[6] + 8; // Correction timezone Beijing
            const minute = data[7];
            const second = data[8];
            
            if (hour >= 24) {
                hour -= 24;
            }
            
            const timestamp = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
            
            // Coordonnées GPS (bytes 9-17)
            const gpsData = this.decodeGPSCoordinates(data.subarray(9, 18));
            
            // Vitesse GPS (byte 18)
            const speedGPS = data[18];
            
            // Direction (byte 19)
            const direction = data[19] * 2;
            
            // Nombre de satellites (byte 20)
            const satellites = data[20];
            
            // Signal GSM (byte 21)
            const gsmSignal = data[21];
            
            // Kilométrage (bytes 22-25)
            const odometer = this.frameDecoder.bytesToInt(data.subarray(22, 26));
            
            // Statut du véhicule (bytes 26-29)
            const statusData = this.decodeStatusFlags(data.subarray(26, 30));
            
            // Données moteur (bytes 30+)
            const engineData = this.decodeEngineData(data.subarray(30));
            
            return {
                type: 'gps_obd_combined',
                tripId,
                timestamp,
                gps: {
                    latitude: gpsData.latitude,
                    longitude: gpsData.longitude,
                    speed: speedGPS,
                    direction,
                    satellites,
                    isValid: gpsData.isValid
                },
                vehicle: {
                    speed: engineData.speed,
                    odometer,
                    throttlePosition: engineData.throttlePosition
                },
                engine: {
                    load: engineData.load,
                    speed: engineData.rpm,
                    coolantTemp: engineData.coolantTemp,
                    intakeTemp: engineData.intakeTemp
                },
                fuel: {
                    instantConsumption: engineData.fuelConsumption1,
                    instantConsumption2: engineData.fuelConsumption2,
                    pressure: engineData.fuelPressure
                },
                system: {
                    voltage: engineData.voltage,
                    gsmSignal,
                    statusFlags: statusData
                }
            };

        } catch (error) {
            logger.error('Erreur décodage GPS+OBD:', error);
            return null;
        }
    }

    /**
     * Commande 3089: Rapport allumage/extinction
     */
    async decodeIgnitionFlameoutReport(frame) {
        try {
            if (!frame.data || frame.data.length < 8) {
                return null;
            }

            const data = frame.data;
            
            // Type d'événement (byte 0): 0x01 = allumage, 0x00 = extinction
            const eventType = data[0] === 0x01 ? 'ignition' : 'flameout';
            
            // ID de voyage (bytes 1-2)
            const tripId = this.frameDecoder.bytesToInt(data.subarray(1, 3));
            
            // Date et heure (bytes 3-8)
            const day = data[3];
            const month = data[4];
            const year = 2000 + data[5];
            let hour = data[6] + 8;
            const minute = data[7];
            const second = data[8];
            
            if (hour >= 24) {
                hour -= 24;
            }
            
            const timestamp = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
            
            // Coordonnées GPS si disponibles (bytes 9+)
            let gpsData = null;
            if (data.length > 18) {
                gpsData = this.decodeGPSCoordinates(data.subarray(9, 18));
            }
            
            return {
                type: 'ignition_flameout_report',
                eventType,
                tripId,
                timestamp,
                gps: gpsData
            };

        } catch (error) {
            logger.error('Erreur décodage rapport allumage/extinction:', error);
            return null;
        }
    }

    /**
     * Commande 308a: Requête de lecture données OBD
     */
    async decodeOBDDataQuery(frame) {
        return {
            type: 'obd_data_query',
            message: 'Query whether to read OBD data',
            data: frame.data ? this.frameDecoder.bytesToHex(frame.data) : null
        };
    }

    /**
     * Commande 308b: Requête consommation moyenne
     */
    async decodeAverageFuelQuery(frame) {
        return {
            type: 'average_fuel_query',
            message: 'Query average fuel consumption',
            data: frame.data ? this.frameDecoder.bytesToHex(frame.data) : null
        };
    }

    /**
     * Commandes générales (0008, 0081, etc.)
     */
    async decodeAlarmConfirmation(frame) {
        return {
            type: 'alarm_confirmation',
            message: 'Alarm confirmation received'
        };
    }

    async decodeManufacturer(frame) {
        return {
            type: 'manufacturer_info',
            message: 'Device manufacturer request'
        };
    }

    async decodeSoftwareVersion(frame) {
        return {
            type: 'software_version',
            message: 'Software version request'
        };
    }

    async decodeDeviceID(frame) {
        return {
            type: 'device_id_query',
            message: 'Device ID number query'
        };
    }

    async decodeFactoryReset(frame) {
        return {
            type: 'factory_reset',
            message: 'Factory reset command'
        };
    }

    async decodeDeviceRestart(frame) {
        return {
            type: 'device_restart',
            message: 'Device restart request'
        };
    }

    /**
     * Décode les coordonnées GPS
     */
    decodeGPSCoordinates(gpsBytes) {
        try {
            if (gpsBytes.length < 9) {
                return { latitude: 0, longitude: 0, isValid: false };
            }

            // Latitude (bytes 0-3)
            const latDegree = gpsBytes[0];
            const latMinutes = this.frameDecoder.bytesToInt(gpsBytes.subarray(1, 4), 10) * 0.0001 / 60;
            let latitude = latDegree + latMinutes;

            // Longitude (bytes 4-8)
            const lonHex = this.frameDecoder.bytesToHex(gpsBytes.subarray(4, 9));
            const lonDegree = parseInt(lonHex.substring(0, 3), 10);
            const lonMinutes = parseInt(lonHex.substring(3, 9), 10) * 0.0001 / 60;
            let longitude = lonDegree + lonMinutes;

            // Identifiant de bit pour direction (byte 8)
            const bitIdentifier = gpsBytes[8];
            const bits = bitIdentifier.toString(2).padStart(8, '0');

            // Appliquer les directions
            const isNorth = bits[1] === '1';
            const isEast = bits[2] === '1';
            const isGPS = bits[3] === '0'; // 0 = GPS, 1 = Base Station
            const isPositioning = bits[0] === '1'; // 0 = Blind Zone, 1 = Positioning

            if (!isNorth) latitude = -latitude;
            if (!isEast) longitude = -longitude;

            return {
                latitude: parseFloat(latitude.toFixed(5)),
                longitude: parseFloat(longitude.toFixed(7)),
                isValid: isPositioning && isGPS
            };

        } catch (error) {
            logger.error('Erreur décodage coordonnées GPS:', error);
            return { latitude: 0, longitude: 0, isValid: false };
        }
    }

    /**
     * Décode les données moteur (basé sur le code Java GPSOBDCommandDecode)
     */
    decodeEngineData(engineBytes) {
        try {
            if (engineBytes.length < 30) {
                logger.warn('Données moteur insuffisantes');
                return {};
            }

            return {
                // Charge moteur (byte 0)
                load: parseFloat((engineBytes[0] * 100 / 255).toFixed(3)),
                
                // Température liquide refroidissement (byte 1)
                coolantTemp: engineBytes[1] - 40,
                
                // Régime moteur (bytes 2-3)
                rpm: this.frameDecoder.bytesToInt(engineBytes.subarray(2, 4)) / 4,
                
                // Vitesse OBD (byte 4)
                speed: engineBytes[4],
                
                // Angle d'avance allumage (byte 5)
                ignitionAdvance: engineBytes[5] / 2 - 64,
                
                // Pression collecteur admission (byte 6)
                intakeManifoldPressure: engineBytes[6],
                
                // Tension module contrôle (byte 7)
                voltage: parseFloat((engineBytes[7] * 0.1).toFixed(1)),
                
                // Température air admission (byte 8)
                intakeTemp: engineBytes[8] - 40,
                
                // Débit d'air (bytes 9-10)
                airFlow: parseFloat((this.frameDecoder.bytesToInt(engineBytes.subarray(9, 11)) * 0.01).toFixed(2)),
                
                // Position papillon relative (byte 11)
                throttleRelativePosition: parseFloat((engineBytes[11] * 100 / 255).toFixed(3)),
                
                // Coefficient carburant long terme (byte 12)
                longTermFuelCoeff: parseFloat((((engineBytes[12] - 128) * 100) / 128).toFixed(3)),
                
                // Coefficient ratio air/carburant (bytes 13-14)
                airFuelRatioCoeff: parseFloat((this.frameDecoder.bytesToInt(engineBytes.subarray(13, 15)) * 0.0000305).toFixed(7)),
                
                // Position papillon absolue (byte 15)
                throttlePosition: parseFloat((engineBytes[15] * 100 / 255).toFixed(3)),
                
                // Pression carburant (byte 16)
                fuelPressure: engineBytes[16] * 3,
                
                // Consommation instantanée 1 (bytes 17-18)
                fuelConsumption1: parseFloat((this.frameDecoder.bytesToInt(engineBytes.subarray(17, 19)) * 0.1).toFixed(1)),
                
                // Consommation instantanée 2 (bytes 19-20)
                fuelConsumption2: parseFloat((this.frameDecoder.bytesToInt(engineBytes.subarray(19, 21)) * 0.1).toFixed(1))
            };

        } catch (error) {
            logger.error('Erreur décodage données moteur:', error);
            return {};
        }
    }

    /**
     * Décode les drapeaux de statut du véhicule
     */
    decodeStatusFlags(statusBytes) {
        try {
            if (statusBytes.length < 4) {
                return {};
            }

            const statusInt = this.frameDecoder.bytesToInt(statusBytes);
            const bits = statusInt.toString(2).padStart(32, '0');

            return {
                longTermIdle: bits[31] === '1',
                oilCutOff: bits[25] === '1',
                wifi4G: bits[24] === '1',
                engineFailure: bits[22] === '1',
                coolantTempLow: bits[21] === '1',
                carSupported: bits[20] === '1',
                towingState: bits[16] === '1',
                accOn: bits[15] === '1',
                undervoltage: bits[8] === '1',
                gpsAbnormal: bits[7] === '1',
                overspeeding: bits[6] === '1',
                fatigueDriving: bits[5] === '1',
                chargingCircuitAbnormal: bits[4] === '1',
                coolantTempHigh: bits[3] === '1',
                maintenanceNeeded: bits[2] === '1',
                throttleCleaningNeeded: bits[1] === '1',
                deviceUnplugged: bits[0] === '1'
            };

        } catch (error) {
            logger.error('Erreur décodage statut:', error);
            return {};
        }
    }
}

module.exports = OBDDecoder; 