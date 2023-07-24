const axios = require('axios');
const http = require('http');
const options = require('./options.js');
// const entities = require('./entities.js');
const { parseTargetTemperatureToRange, parseRinnaiTemperature, delay, round } = require('./utils.js');
const rinnaiApi = axios.create({
    baseURL: `http://${options.device.host}/`,
    timeout: 0,
    headers: {'X-Custom-Header': 'foobar'},
    httpAgent: new http.Agent({ keepAlive: true })
});

const setPriority = (requirePriority) => {
    //console.log("[RINNAI API] requirePriority", requirePriority)
    const priority = requirePriority ? options.haIp : "null";
    //console.log("[RINNAI API] set priority - priority:", priority)
    try {
        rinnaiApi(`ip:${priority}:pri`)
            .then((response) => {
                console.log(e.message);
                //entities.switchPriority.publish('ON')
                //entities.priorityIP.publish(options.haIp)
                //console.log("[RINNAI API] set priority IP to", options.haIp)
                return true;
            })
            .catch((e) => {
                console.log(e.message);
                //console.log(e)
                //console.log("[RINNAI API] set priority error", e?.message || e) //error socket hang up
                //entities.switchPriority.publish('OFF')
                //entities.priorityIP.publish('Não atribuido')
                return false;
            });
    }  catch (e) {
            console.log(e.message);
            //console.log(e)
            //console.log("[RINNAI API] set priority error", e?.message || e) //error socket hang up
            //entities.switchPriority.publish('OFF')
            //entities.priorityIP.publish('Não atribuido')
            return false;
    }
}

// let preventUpdate = false;
// const getPreventUpdate = () => preventUpdate;
// const startPreventingUpdates = () => preventUpdate = true;
// const stopPreventingUpdates = () => preventUpdate = false;

const setTargetTemperature = async (target, lastTargetTemp = undefined, retries = 0) => {
    //startPreventingUpdates();
    try {
        const targetTemperatureInRange = parseTargetTemperatureToRange(target);
        let currentTargetTemp = +lastTargetTemp;

        if (!lastTargetTemp) {
            const { targetTemperature: stateTargetTemp, priorityIp } = await getState();
            currentTargetTemp = stateTargetTemp;
            console.log("Current Temp:", currentTargetTemp);
            const otherDeviceHasPriority = priorityIp !== "null" && priorityIp !== options.haIp;
            if (otherDeviceHasPriority) {
                console.log("[RINNAI API] other device has priority");
                //stopPreventingUpdates();
                return false;
            }
            //setPriority(true)

        }

        // if (targetTemperatureInRange === currentTargetTemp) {
        //     stopPreventingUpdates();
        //     //setPriority(false)
        //     return currentTargetTemp;
        // }

        const operation = currentTargetTemp > targetTemperatureInRange ? 'dec' : 'inc';
        const response = await rinnaiApi(operation);
        const parsedParams = parseStateParams(response.data);
        currentTargetTemp = parsedParams.targetTemperature;

        //entities.priorityIP.publish(parsedParams.priorityIp)
        //console.log('[RINNAI API] Priority Ip: ',parsedParams.priorityIp)
        // const otherDeviceHasPriority = parsedParams.priorityIp !== "null" && parsedParams.priorityIp !== options.haIp
        // if (otherDeviceHasPriority) {
        //     console.log("[RINNAI API] other device has priority")
        //     stopPreventingUpdates()
        //     await setPriority(false)
        //     return false
        // }

        // if (targetTemperatureInRange === currentTargetTemp) {
        //     stopPreventingUpdates();
        //     //setPriority(false)
        //     return currentTargetTemp;
        // }

        await delay(60);

        setTargetTemperature(target, currentTargetTemp, 0);
    }
    catch (e) {
        if (retries < 5)
            return setTargetTemperature(target, lastTargetTemp, retries + 1);
        console.log("[RINNAI API] set temperature error", e?.message || e);
        //stopPreventingUpdates();
        //setPriority(false)
        return false;
    }
}

const setPowerState = async (turnOn) => {
    const { isPoweredOn } = await getState();;
    if (isPoweredOn === turnOn) return true;
    const response = await rinnaiApi('/lig');
    return parseStateParams(response.data);
}


const pressButton = async (button) => {
    //setPriority(true)
    const response = await rinnaiApi(button);
    const params = parseStateParams(response.data);
    //setPriority(false)
    return params;

}



const parseStateParams = (stringifiedParams) => {
    const params = stringifiedParams.split(',');
    const targetTemperature = parseRinnaiTemperature(params[7]);
    const isHeating = params[2] === '1';
    //const priorityIp = params[6].split(":")[0];
    const isPoweredOn = params[0] !== "11";

    console.log("[RINNAI API] targetTemperature", targetTemperature);
    return {
        targetTemperature,
        isHeating,
        isPoweredOn
        //priorityIp
    }
}


const getState = () => {
    console.log("[RINNAI API] fetching heater state");
    return rinnaiApi('/tela_').then(response => parseStateParams(response.data));
}

const getDeviceParams = () => {
    console.log("[RINNAI API] fetching heater parameters");
    return rinnaiApi('/bus')
        .then((response) => {
            const params = response.data.split(",");
            const targetTemperature = parseRinnaiTemperature(params[18]);
            const inletTemperature = +params[10] / 100;
            const outletTemperature = +params[11] / 100;
            const currentPowerInKCal = +params[9] / 100;
            const powerInkW = round(currentPowerInKCal * 0.014330754);
            const isPoweredOn = params[0] !== "11";

            const waterFlow = round(+params[12] / 100);
            const workingTime = +params[4];
            console.log("[RINNAI API] RAW workingTime", workingTime);
            return {
                targetTemperature,
                inletTemperature,
                outletTemperature,
                powerInkW,
                isPoweredOn,
                waterFlow,
                workingTime
            }
        })
}

const getConsumption = () =>
    rinnaiApi('/consumo')
        .then(response => {
            const params = response.data.split(',');
            const [minutes, seconds] = params[0].split(':');
            const workingTime = (+minutes * 60) + +seconds;
            const water = round(+params[1] / 1000);
            const gas = round(+params[2] / 9400);
            console.log("[RINNAI API] workingTime", workingTime);
            return { water, gas, workingTime };
        })


module.exports = {
    setTargetTemperature,
    getDeviceParams,
    //getPreventUpdate,
    getState,
    //setPriority,
    setPowerState,
    pressButton,
    getConsumption
}



/*
IMPLEMENTAR TRATAMENTO DE STATUS E ERROS

CÓDIGO DE DIAGNÓSTICO	MOTIVO
02	Desligamento pelo timer (60 minutos)
10	Problema na ventoinha ou obstrução no fluxo
11	Ao ligar não acende ( falta gás,...).
12	Falta de gás durante o uso
14	Fusível ou termostato rompido
16	Alta temperatura da água
19	Fiação está em curto, fuga de corrente.
32	Termistor com problema
52	Válvula modulador de gás (POV) com problema.
61	Conector da ventoinha solto (RPM)
71	Válvula solenóide com problema de acionamento
72	Sensor de chama com problema
90	Ao ligar não aciona a ventoinha
99	Ventoinha com problema

"Status ligado/desligado/stand-by: $col0"
"Erros do sistma: $col01"
"Número de acionamentos: $col03"
"Horas de combustão: $col04"
"Horas de stand-by: $col05"
"Rotação da ventoinha: $col07"
"Corrente: $col08"
"Potência máxima (kcal/min): $col09"
"Temperatura de entrata: $col10"
"Temperatura de saída: $col11"
"Fluxo real: $col12"
"Vazão mínima p/ acionamento: $col13"
"Vazão mínima p/ desligamento: $col14"
"Temperatura setada: $col15"
"Endereço IP: $col16"
"Número de série: $col19"
"Data Firmware: $col22"
"MAC Address: $col25"
"Sinal wi-fi: $col37"

// Tratamento do status
if (msg.payload[0] == 11){
msg.payload[0] = "desligado"
}
if (msg.payload[0] == 41 && msg.payload[2] == 0) {
msg.payload[0] = "stand-by"
}
if (msg.payload[0] == 41 && msg.payload[2] == 1) {
msg.payload[0] = "em uso"
}
if (msg.payload[0] == 21 && msg.payload[2] == 1) {
msg.payload[0] = "em uso"
}
if (msg.payload[0] == 42 && msg.payload[2] == 1) {
msg.payload[0] = "em uso"
}
if (msg.payload[0] == 43 && msg.payload[2] == 1) {
msg.payload[0] = "em uso"
}

//Tratamento dos erros
if (msg.payload[1] == 12) {
msg.payload[1] = "Código: 12 - Falta de gás em uso"
}
else {

if (msg.payload[1] == 10) {
msg.payload[1] = "Código: 10 - Ventoinha Obstruída"
}
else {
msg.payload[1] = "OK"
}

// Sensor geral
msg.entity_id = 'sensor.cozinha_aquecedor_a_gas'

msg.payload = {
    data: {
        state: msg.payload[0],
        attributes: {
            funcionamento: msg.payload[1],
            vazao_minima_para_acionamento: parseFloat(msg.payload[13] * 0.01).toFixed(2),
            vazao_minima_para_desligamento: parseFloat(msg.payload[14] * 0.01).toFixed(2),
            data_firmware: msg.payload[22],
            horas_de_combustao: msg.payload[4],
            potencia_maxima_kcal_min: msg.payload[9],
            rotacao_da_ventoinha: msg.payload[7],
            corrente: msg.payload[8],
            horas_de_stand_by: msg.payload[5],
            numero_de_serie: msg.payload[19],
            icon: "mdi:information",
            friendly_name: "COZINHA Aquecedor à Gás",
        }
    }
};

*/

/*
Estou tentando descobrir em qual campo consigo a informação sobre o tempo atual de uso, para criar uma automação que reduza a temperatura da água após 12 minutos de banho até chegar aos 36 (semelhante ao que é possível configurar no app da Rinnai em perfil do usuário) - e depois desligue.

No entanto, rodando o código localmente, reparei que alguns dos meus campos de retorno são diferentes dos presumidos por você.

/bus.data: '41,0,0,3400,227,7200,10000,0,0,0,2008,2505,0,278,208,3700,0.0.0.0,null:pri,5,22193138,16244,0,Sep 16 2022,0,Software/System restart,xx:xx:xx:xx:xx:xx,0,0,45,0,0,0,0,0,0,0,0,-84,[0],0'

Enfim, vou tentar decompilar o apk do app da Rinnai para veriguar se consigo alguma informação útil.



@ale-jr seguem novos campos que eram desconhecidos e são relativos as opções encontradas no menu "Perfil"do app:

29 - duração máxima (em minutos) do tempo de banho antes da redução da temperatura
30 e 31 são um OR - apenas um pode estar ativado com um número "1" e corresponde na sequencia a "monitorar todos os banhos" ou "monitorar apenas o próximo banho"
32 - intervalo em segundos para a redução de 1 grau
33 - preço do m3 da água (últimos 2 digitos são casas decimais)
34 - preço do m3 do gás (últimos 2 digitos são casas decimais)

Amanhã durante o dia vou configurar com valores corretos e testar em qual campo é retornado o custo do banho.

No entendo ainda precisamos descobrir como realizar o update dessas informações ou obter por get o tempo decorrido do banho.
*/


/*
/historico
1:04,6,4,43,1689086642;2:43,6,9,125,1689086539;13:06,6,103,2054,1689081263;1:12,6,3,54,1689077327;17:48,7,235,5117,1689028802;15:39,7,123,2629,1689022175;1:48,7,7,140,-8024;2:01,7,8,134,-8239;5:45,7,22,442,1688976524;11:54,7,94,1939,1688933971;
[0] - tempo banho (mm:ss)
[1] - 
[2] - litros
[3]
[4] - timestamp unix epoch

*/
