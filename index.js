const fetch = require('node-fetch');

exports.handler = function (request, context) {

    const server = 'http://147.182.237.110/chapa/';
    const now = new Date();

    if (request.directive.header.namespace === 'Alexa.Discovery'
        && request.directive.header.name === 'Discover') {
        log("DEBUG:", "Discover request", JSON.stringify(request));
        handleDiscovery(request, context);
    }
    else if (request.directive.header.namespace === 'Alexa.LockController') {
        if (request.directive.header.name === 'Lock' || request.directive.header.name === 'Unlock') {
            log("DEBUG:", "LOCKED, UNLOCKED Request", JSON.stringify(request));
            handleControl(request, context);
        }
    } 
    else if (request.directive.header.namespace === 'Alexa') {
        if (request.directive.header.name === 'ReportState') {
            log("DEBUG:", "StateReport Request", JSON.stringify(request));
            handleStateReport(request, context);
        }
    }

    function log(message, message1, message2) {
        console.log(message + " - " + message1 + " - " + message2);
    }

    function hayError(result, header, endpointId) {

        let typeError, messageError;

        if (result === undefined) {
            typeError = 'EXPIRED_AUTHORIZATION_CREDENTIAL';
            messageError = '';

            header.namespace = "Alexa";
            header.name = "ErrorResponse";

            const payload = {
                "type": typeError,
                "message": messageError
            }

            const endpoint = {
                "endpointId": endpointId
            }

            log("DEBUG", "Error Response: ", JSON.stringify({ header: header, endpoint: endpoint, payload: payload }));
            context.succeed({ event: { header: header, endpoint: endpoint, payload: payload } });
            return true;
            
        } else if (result !== undefined && result.error) {
            
            switch(result.code){
                case 1: 
                        typeError = 'EXPIRED_AUTHORIZATION_CREDENTIAL';
                        messageError = '';
                        break;
                case 2: 
                        typeError = 'INVALID_AUTHORIZATION_CREDENTIAL';
                        messageError = '';
                        break;
                default:
                        typeError = 'INVALID_AUTHORIZATION_CREDENTIAL';
                        messageError = '';
                        break;
            }

            header.namespace = "Alexa";
            header.name = "ErrorResponse";

            const payload = {
                "type": typeError,
                "message": messageError
            }

            const endpoint = {
                "endpointId": endpointId
            }

            log("DEBUG", "Error Response: ", JSON.stringify({ header: header, endpoint: endpoint, payload: payload }));
            context.succeed({ event: { header: header, endpoint: endpoint, payload: payload } });
            return true;
            
        } else {
            return false;
        }

    }

    async function handleDiscovery(request, context) {

        log("DEBUG", "Context", JSON.stringify(context));
        const header = request.directive.header;
        header.name = "Discover.Response";
        header.messageId = header.messageId + "-R";


        // get user token pass in request
        const token = request.directive.payload.scope.token;
        const paramsHeaders = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
        const paramsBody = {};
        const url = 'api/alexa/discovery';

        const result = await peticionServidor(token, url, 'GET', paramsHeaders, paramsBody);

        if (hayError(result, header)) { } else {
            var payload = { "endpoints": [] };
            result.forEach(element => {
                payload.endpoints.push(
                    {
                        "endpointId": element.ch_num_serie,
                        "manufacturerName": "LEMP system",
                        "description": "Chapa inteligente",
                        "friendlyName": element.ch_alias,
                        "displayCategories": ["SMARTLOCK"],
                        "cookie": {},
                        "capabilities": [
                            {
                                "type": "AlexaInterface",
                                "interface": "Alexa.LockController",
                                "version": "3",
                                "properties": {
                                    "supported": [
                                        {
                                            "name": "lockState"
                                        }
                                    ],
                                    "proactivelyReported": true,
                                    "retrievable": true
                                }
                            },
                            {
                                "type": "AlexaInterface",
                                "interface": "Alexa",
                                "version": "3"
                            }
                        ]
                    }
                )
            });

            log("DEBUG", "Discovery Response: ", JSON.stringify({ header: header, payload: payload }));
            context.succeed({ event: { header: header, payload: payload } });
        }

    }

    async function handleControl(request, context) {
        
        // get device ID passed in during discovery
        const requestMethod = request.directive.header.name;
        const responseHeader = request.directive.header;
        responseHeader.namespace = "Alexa";
        responseHeader.name = "Response";
        responseHeader.messageId = responseHeader.messageId + "-R";
        const endpointId = request.directive.endpoint.endpointId;

        let lockState, accion;
        if (requestMethod === "Lock") {
            lockState = "LOCKED";
            accion = 2;
        }
        else if (requestMethod === "Unlock") {
            lockState = "UNLOCKED";
            accion = 1;
        }

        // get user token pass in request
        const token = request.directive.endpoint.scope.token;
        const paramsHeaders = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
        const paramsBody = {
            "num_serie": endpointId,
            "id_accion": accion
        };

        const url = 'api/alexa/accion';
        const result = await peticionServidor(token, url, 'PUT', paramsHeaders, paramsBody);

        if (hayError(result, responseHeader, endpointId)) { } else {

            const contextResult = {
                "properties": [{
                    "namespace": "Alexa.LockController",
                    "name": "lockState",
                    "value": lockState,
                    "timeOfSample": now, //retrieve from result.
                    "uncertaintyInMilliseconds": 1000
                }]
            };
            const response = {
                event: {
                    header: responseHeader,
                    endpoint: {
                        scope: {
                            type: "BearerToken",
                            token: token
                        },
                        endpointId: endpointId
                    },
                    payload: {}
                },
                context: contextResult
            };
            log("DEBUG", "Alexa.Response accion ", JSON.stringify(response));
            context.succeed(response);
        }


    }

    async function handleStateReport(request, context) {

        const responseHeader = request.directive.header;
        const endpointId = request.directive.endpoint.endpointId;

        // get user token pass in request
        const token = request.directive.endpoint.scope.token;
        const paramsHeaders = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
        const paramsBody = {};
        const url = 'api/alexa/status/' + endpointId;
        const result = await peticionServidor(token, url, 'GET', paramsHeaders, paramsBody);

        if (hayError(result, responseHeader, endpointId)) { } else {

            responseHeader.namespace = "Alexa";
            responseHeader.name = "StateReport";
            responseHeader.messageId = responseHeader.messageId + "-R";
            // get user token pass in request
            let lockState;

            if (result[0].abrir === '1') {
                lockState = 'UNLOCKED';
            } else {
                lockState = 'LOCKED';
            }

            const contextResult = {
                "properties": [{
                    "namespace": "Alexa.LockController",
                    "name": "lockState",
                    "value": lockState,
                    "timeOfSample": now, //retrieve from result.
                    "uncertaintyInMilliseconds": 1000
                }]
            };
            const response = {
                event: {
                    header: responseHeader,
                    endpoint: {
                        scope: {
                            type: "BearerToken",
                            token: token
                        },
                        endpointId: endpointId
                    },
                    payload: {}
                },
                context: contextResult
            };
            log("DEBUG", "Alexa - StateReport ", JSON.stringify(response));
            context.succeed(response);
        }
    }

    async function peticionServidor(token, ruta, metodo, headersParams, bodyParams) {
        const RUTA = server + ruta;
        let respuest;

        log("DEBUG", "DATOS-RUTA:", RUTA);
        log("DEBUG", "DATOS-Metodo:", metodo);
        log("DEBUG", "DATOS-Token:", token);
        log("DEBUG", "DATOS-Header:", JSON.stringify(headersParams));
        log("DEBUG", "DATOS-Body:", JSON.stringify(bodyParams));


        if (metodo == 'GET') {
            log("DEBUG", "Invocando MEtodo", "GET");

            await fetch(RUTA, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            })
                .then(res => res.json())
                .then(json => {respuest = json;});

        } else {

            log("DEBUG", "Invocando MEtodo", metodo);
            log("DEBUG", 'num_serie', bodyParams.num_serie);
            log("DEBUG", 'id_accion', bodyParams.id_accion);

            await fetch(RUTA, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(bodyParams)
            })
                .then(res => res.json())
                .then(json => {respuest = json;});
        }

        log("DEBUG - ", "respuesta peticion: " + RUTA + " ", JSON.stringify(respuest));

        return respuest;
    }

};