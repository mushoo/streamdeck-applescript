var websocket = null,
    piContext = 0,
    MActions = {},
    runningApps = [],
    contextArray = [],
    DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 });

function connectSocket (
    inPort,
    inUUID,
    inMessageType,
    inApplicationInfo,
    inActionInfo
) {
    if (websocket) {
        websocket.close();
        websocket = null;
    };

    var appInfo = JSON.parse(inApplicationInfo);
    var isMac = appInfo.application.platform === 'mac';

    var getApplicationName = function (jsn) {
        if (jsn && jsn['payload'] && jsn.payload['application']) {
            return isMac ? jsn.payload.application.split('.').pop() : jsn.payload.application.split('.')[0];
        }
        return '';
    };

    websocket = new WebSocket('ws://localhost:' + inPort);

    websocket.onopen = function () {
        var json = {
            event: inMessageType,
            uuid: inUUID
        };

        websocket.send(JSON.stringify(json));
    };

    websocket.onclose = function (evt) {
        console.log('[STREAMDECK]***** WEBOCKET CLOSED **** reason:', evt);
    };

    websocket.onerror = function (evt) {
        console.warn('WEBOCKET ERROR', evt, evt.data);
    };

    websocket.onmessage = function (evt) {
        try {
            var jsonObj = JSON.parse(evt.data);
            var event = jsonObj['event'];

            if (~['applicationDidLaunch', 'applicationDidTerminate'].indexOf(event)) {
                const app = capitalize(getApplicationName(jsonObj));
                const img = `images/${jsonObj.payload.application}.png`;
                const arrImages = event === 'applicationDidTerminate' ? [img, 'images/terminated.png'] : img;
                contextArray.forEach(a => {
                    loadAndSetImage(a, arrImages);
                });

                if (event === 'applicationDidLaunch') {
                    if (!runningApps.includes(app)) { runningApps.push(app); };
                } else if (event === 'applicationDidTerminate') {
                    runningApps = runningApps.filter(item => item !== app);
                }

                if (piContext && piContext !== 0) { // there's a property inspector
                    sendToPropertyInspector(piContext, { runningApps });
                }

            } else {
                /** dispatch message for V1 */
                const aEvt = !jsonObj.hasOwnProperty('action') ? jsonObj.event : jsonObj['action'] + '.' + jsonObj['event'];
                if (MActions.hasOwnProperty(aEvt)) {
                    MActions[aEvt](jsonObj);
                }

                /** dispatch message for V2 */
                /* we could also use this (although a bit hacky), to keep the original plugin-structure */
                if (jsonObj.hasOwnProperty('action')) {
                    var actn = jsonObj.action.split('.').splice(-1)[0];
                    console.log('actn:', actn);
                    if (window[actn].hasOwnProperty(jsonObj.event)) {
                        window[actn][jsonObj.event](jsonObj);
                    }
                }

                /** dispatch message for V3 */
                /* even more hacky, but works for multi-actions */
                let bEvt;
                if (jsonObj['event'] && jsonObj['event'] === 'willAppear') {
                    bEvt = jsonObj['event'];
                } else {
                    bEvt = !jsonObj.hasOwnProperty('action') ? jsonObj.event : jsonObj.event + jsonObj['context'];
                }

                if (actionV3.hasOwnProperty(bEvt)) {
                    actionV3[bEvt](jsonObj);
                }
            }
        } catch (error) {
            console.trace('Could not parse incoming message', error, evt.data);
        }
    };
}

/** Here are a bunch of experiments how to even more streamline communication with the PI */

/**
 * V1 define the actions in an object
 * Will not work in multiactions, but can be extended as in V3
 * */

MActions['com.elgato.pisamples.action.willAppear'] = function (jsn) {
    console.log('**V1** MActions.WILLAPPEAR', jsn.context);
};

MActions['com.elgato.pisamples.action.willDisappear'] = function (jsn) {
    console.log('**V1** MActions.WILLDISAPPEAR ', jsn.context);
};

MActions['com.elgato.pisamples.action.keyUp'] = function (jsn) {
    console.log('**V1** MActions.KEYUP ', jsn.context);
};

MActions['com.elgato.pisamples.action.keyDown'] = function (jsn) {
    console.log('**V1** MActions.KEYDOWN ', jsn.context);
};

MActions['com.elgato.pisamples.action.sendToPlugin'] = function (jsn) {
    console.log('**V1** MActions.SENDTOPLUGIN:', jsn.context, jsn);
    console.log('%c%s', 'color: white; background: darkgreen; font-size: 12px;', `**V1** PI SENDTOPLUGIN for ${jsn.context}`);
};

/**
 * V2 keep old plugin structure
 * Will not work in multi-actions (without caching the context)
 * */

var action = {

    willAppear: function (jsn) {
        console.log('**V2** action.WILLAPPEAR', jsn.context);
    },

    willDisappear: function (jsn) {
        console.log('**V2** action.WILLDISAPPEAR', jsn.context);
    },

    keyDown: function (jsn) {
        console.log('**V2** action.KEYDOWN', jsn.context);
    },

    keyUp: function (jsn) {
        console.log('**V2** action.KEYUP', jsn.context);
    },

    sendToPlugin: function (jsn) {
        console.log('**V2** action.SENDTOPLUGIN', jsn.context, jsn);
        console.log('%c%s', 'color: white; background: pink; font-size: 12px;', `**V2** PI SENDTOPLUGIN for ${jsn.context}`);
    }

};

/**
 * V3 restrict to context
 * This will also work with multi-actions stored in different contexts
*/

var actionV3 = {

    willAppear: function (jsn) {
        console.log('**V3** actionV3.WILLAPPEAR', jsn.context);
        if (!contextArray.includes(jsn.context)) {
            contextArray.push(jsn.context);
        }

        actionV3['keyDown' + jsn.context] = function (jsn) {
            console.log('**V3** actionV3.KEYDOWN', jsn.context);
        };

        actionV3['keyUp' + jsn.context] = function (jsn) {
            console.log('**V3** actionV3.KEYUP', jsn.context);
        };

        actionV3['sendToPlugin' + jsn.context] = function (jsn) {
            console.log('**V3** actionV3.SENDTOPLUGIN', jsn.context, jsn);
            if (jsn.hasOwnProperty('payload')) {
                const pl = jsn.payload;
                if (pl.hasOwnProperty('property_inspector')) {
                    const pi = pl.property_inspector;
                    console.log('%c%s', 'font-style: bold; color: white; background: blue; font-size: 15px;', `PI-event for ${jsn.context}:${pi}`);
                    switch (pl.property_inspector) {
                    case 'propertyInspectorWillDisappear':
                        loadAndSetImage(jsn.context, `images/piterminated.png`);
                        setTimeout(() => {
                            loadAndSetImage(jsn.context, `images/default.png`);
                        }, 500);
                        setContext(0); // set a flag, that our PI was removed
                        break;
                    case 'propertyInspectorConnected':
                        setContext(jsn.context);
                        sendToPropertyInspector(jsn.context, { runningApps });
                        break;
                    };
                } else {
                    if (pl.hasOwnProperty('sdpi_collection')) {
                        console.log('%c%s', 'color: white; background: blue; font-size: 12px;', `PI SENDTOPLUGIN for ${jsn.context}`);

                        if (pl.sdpi_collection['key'] === 'your_canvas') {
                            setImage(jsn.context, pl.sdpi_collection['value']);
                        } else {
                            setTitle(jsn.context, pl.sdpi_collection['value']);
                        }
                    } else if (pl.hasOwnProperty('DOM')) {

                    } else {
                        console.log('%c%s', 'color: white; background: green; font-size: 12px;', `PI SENDTOPLUGIN for ${jsn.context}`);
                    }
                }
            }
        };

        actionV3['willDisappear' + jsn.context] = function (jsn) {
            console.log('**V3** action.WILLDISAPPEAR', jsn.context, contextArray);
            contextArray = contextArray.filter(item => item !== jsn.context);
            console.log(contextArray);
        };

    }
};

/** STREAM DECK COMMUNICATION */

function sendToPropertyInspector (context, jsonData, xx) {
    var json = {
        'event': 'sendToPropertyInspector',
        'context': context,
        'payload': jsonData
    };
    console.log('-----');
    console.log('sending to Property Inspector', xx, context, piContext, json, JSON.stringify(json));
    websocket.send(JSON.stringify(json));
};

function setTitle (context, newTitle) {
    // var apps = runningApps.join('\n');

    var json = {
        'event': 'setTitle',
        'context': context,
        'payload': {
            // 'title': `${newTitle}\n${apps}`,
            'title': `${newTitle}`,
            'target': DestinationEnum.HARDWARE_AND_SOFTWARE
        }
    };

    websocket.send(JSON.stringify(json));
};

function setImage (context, imgData) {

    var json = {
        'event': 'setImage',
        'context': context,
        'payload': {
            'image': imgData,
            'target': DestinationEnum.HARDWARE_AND_SOFTWARE
        }
    };

    websocket.send(JSON.stringify(json));
};

function loadAndSetImage (context, imageNameOrArr) {
    loadImage(imageNameOrArr, function (data) {
        var json = {
            'event': 'setImage',
            'context': context,
            'payload': {
                'image': data,
                'target': DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        };
        websocket.send(JSON.stringify(json));
    });
};

/** UTILS */

function capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

function equalArray (a, b) {
    if (a.length != b.length) {
        return false;
    }
    return a.filter(function (i) {
        return !b.includes(i);
    }).length === 0;
}

function setContext (ctx) {
    console.log('%c%s', 'color: white; background: blue; font-size: 12px;', 'piContext', ctx, piContext);
    piContext = ctx;
    console.log('new context: ', piContext);
}

function loadImage (inUrl, callback, inCanvas, inFillcolor) {
    /** Convert to array, so we may load multiple images at once */
    const aUrl = !Array.isArray(inUrl) ? [inUrl] : inUrl;
    const canvas = inCanvas && inCanvas instanceof HTMLCanvasElement
        ? inCanvas
        : document.createElement('canvas');
    var imgCount = aUrl.length - 1;
    const imgCache = {};

    var ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    for (let url of aUrl) {
        let image = new Image();
        let cnt = imgCount;
        let w = 144, h = 144;

        image.onload = function () {
            imgCache[url] = this;
            // look at the size of the first image
            if (url === aUrl[0]) {
                canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
                canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size
            }
            // if (Object.keys(imgCache).length == aUrl.length) {
            if (cnt < 1) {
                if (inFillcolor) {
                    ctx.fillStyle = inFillcolor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                // draw in the proper sequence FIFO
                aUrl.forEach(e => {
                    if (!imgCache[e]) {
                        console.warn(imgCache[e], imgCache);
                    }

                    if (imgCache[e]) {
                        ctx.drawImage(imgCache[e], 0, 0);
                        ctx.save();
                    }
                });

                callback(canvas.toDataURL('image/png'));
                // or to get raw image data
                // callback && callback(canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, ''));
            }
        };

        imgCount--;
        image.src = url;
    }
};
