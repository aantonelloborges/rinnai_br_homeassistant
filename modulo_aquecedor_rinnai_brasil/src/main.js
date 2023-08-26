const device = require('./device.js');
// const rinnaiApi = require('./rinnai-api.js');
const mqttClient = require('./mqtt.js');
const options = require("./options.js");
const entities = require('./entities.js');
const { delay } = require('./utils.js');
const SmartInterval = require("smartinterval");

mqttClient.on("connect", () => {
    console.log("[MQTT] Connected");
    mqttClient.subscribe(entities.waterTargetTemperature.commandTopic, (error) => {
        if (error) console.log('[MQTT] set water target temp subscription error', error);
        else console.log('[MQTT] subscribed to set water target temp topic');
    })

    mqttClient.subscribe(entities.switchHeating.commandTopic, (error) => {
        if (error) console.log('[MQTT] switch heater subscription error', error);
        else console.log('[MQTT] subscribed to switch heater topic');
    })

    //mqttClient.subscribe(entities.switchPriority.commandTopic, (error) => {
    //    if (error) console.log('[MQTT] switch priority subscription error', error);
    //    else console.log('[MQTT] subscribed to switch priority topic');
    //})

    mqttClient.subscribe(entities.increaseTemperatureButton.commandTopic, (error) => {
        if (error) console.log('[MQTT] increase temperature subscription error', error);
        else console.log('[MQTT] subscribed to increase temperature topic');
    })

    mqttClient.subscribe(entities.decreaseTemperatureButton.commandTopic, (error) => {
        if (error) console.log('[MQTT] decrease temperature subscription error', error);
        else console.log('[MQTT] subscribed to decrease temperature topic');
    })
})

mqttClient.on('message', (topic, message) => {
    switch (topic) {
        case entities.waterTargetTemperature.commandTopic:
            device.setTargetWaterTemperature(+message.toString());
            break;
        case entities.switchHeating.commandTopic:
            device.setPowerState(message.toString());
            break;
        //case entities.switchPriority.commandTopic:
        //    device.setPriority(message.toString());
        //    break;
        case entities.increaseTemperatureButton.commandTopic:
            device.increaseTemperature();
            break;
        case entities.decreaseTemperatureButton.commandTopic:
            device.decreaseTemperature();
            break;
    }
})

const {execSync} = require('child_process');
var intervalChange = true;
var pollIntervalInMs = (options.device.poll_interval * 1_000) || 2_000;

while (true) { 

    var hh = new Date().getHours();
    var mm = new Date().getMinutes();

    console.log(hh, "h", mm, "m");

    if (hh >= 6 && hh <= 23) {
        console.log("Dia");
        intervalChange = true;
        pollIntervalInMs = (options.device.poll_interval * 1_000) || 2_000;
    } else if (hh > 23 && hh < 5) {
        console.log("Noite");
        intervalChange = true;
        pollIntervalInMs = (options.device.poll_interval * 5_000) || 6_000;    
    }

    if(intervalChange) {
        intervalChange = false;

        try {
            dataFetcher.stop();
        } catch (e) {
        }

        var dataFetcher = new SmartInterval(
            async () => {
                await device.updateDeviceState();
                await delay(500);
                await device.updateParameters();
                await delay(500);
                await device.updateConsumption();
            }
            , pollIntervalInMs
        );

        console.log("dataFetcher start");
        dataFetcher.start();
        dataFetcher.forceExecution();
    }

    execSync('sleep 60');
}