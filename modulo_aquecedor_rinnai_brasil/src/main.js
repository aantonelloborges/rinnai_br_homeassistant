const device = require('./device.js');
const rinnaiApi = require('./rinnai-api.js');
const mqttClient = require('./mqtt.js');
const options = require("./options.js");
const entities = require('./entities.js');
const { delay } = require('./utils.js');
const SmartInterval = require("smartinterval");

const {execSync} = require('child_process');
var intervalChange = null;
var pollIntervalInMs = (options.device.poll_interval * 1_000) || 2_000;

var partOfTheDay = null
var intervalChange = null

const getInterval = () => {
    var hh = new Date().getHours()
    var mm = new Date().getMinutes()
    console.log(hh, "h", mm, "m")

    if (hh >= 6 && hh <= 23) {
        if (partOfTheDay != "Day")
            intervalChange = true

        console.log("Day")
        partOfTheDay = "Day"
        pollIntervalInMs = (options.device.poll_interval * 1_000) || 2_000

    } else if (hh > 23 && hh < 6) {
        if (partOfTheDay != "Night")
            intervalChange = true

        console.log("Night")
        partOfTheDay =  "Night"
        pollIntervalInMs = (options.device.poll_interval * 5_000) || 6_000   
    }
    return pollIntervalInMs, intervalChange
}

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



while (true) { 

    pollIntervalInMs, intervalChange = getInterval();
    console.log(pollIntervalInMs, intervalChange)

    if(intervalChange) {
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