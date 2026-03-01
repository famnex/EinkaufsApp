var Alexa = require("ask-sdk-core");
var fetchFn = require("node-fetch");

var API_BASE = "https://gabelguru.de/api/alexa/";

// ---------- Hilfsfunktionen ----------

function buildUrl(base, path) {
    var b = base || "";
    var p = path || "";
    if (!p) return b;
    var bEnds = b.charAt(b.length - 1) === "/";
    var pStarts = p.charAt(0) === "/";
    if (bEnds && pStarts) return b + p.substring(1);
    if (!bEnds && !pStarts) return b + "/" + p;
    return b + p;
}

async function postJson(path, payload, accessToken) {
    var url = buildUrl(API_BASE, path);
    var res = await fetchFn(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("API error " + res.status);
    var text = await res.text();
    if (!text || (text.charAt(0) !== '{' && text.charAt(0) !== '[')) return {};
    try { return JSON.parse(text); } catch (e) { return {}; }
}

function getSlots(hi) {
    var req = hi.requestEnvelope.request;
    return (req.intent && req.intent.slots) ? req.intent.slots : {};
}

function getSlotValue(slots, slotName) {
    var s = slots && slots[slotName];
    if (!s) return null;

    var rpa = s.resolutions && s.resolutions.resolutionsPerAuthority;
    if (Array.isArray(rpa) && rpa.length > 0) {
        var auth0 = rpa[0];
        var status = auth0 && auth0.status;
        var values = auth0 && auth0.values;

        if (status && status.code === "ER_SUCCESS_MATCH" &&
            Array.isArray(values) && values.length > 0 &&
            values[0] && values[0].value && values[0].value.name) {
            return String(values[0].value.name).trim();
        }
    }

    return s.value ? String(s.value).trim() : null;
}

function getAccessToken(hi) {
    var user = hi.requestEnvelope.context && hi.requestEnvelope.context.System && hi.requestEnvelope.context.System.user;
    return user ? user.accessToken : null;
}

function handleNoAccount(hi) {
    return hi.responseBuilder
        .speak("Bitte verbinde dein Konto in der Alexa App, um Gabel Guru zu nutzen.")
        .withLinkAccountCard()
        .getResponse();
}

// ---------- Parsing & Normalisierung ----------

function normalizeUnit(u) {
    if (!u) return null;
    u = String(u).toLowerCase().trim();
    var map = {
        "g": "gramm", "gr": "gramm", "gramm": "gramm", "gramme": "gramm", "grammen": "gramm",
        "kg": "kilogramm", "kilo": "kilogramm", "kilogramm": "kilogramm",
        "l": "liter", "liter": "liter", "litern": "liter",
        "ml": "milliliter", "milliliter": "milliliter",
        "stk": "stück", "stueck": "stück", "stück": "stück", "stücken": "stück", "stücke": "stück",
        "pack": "packung", "packung": "packung", "packungen": "packung", "päckchen": "packung",
        "dose": "dose", "dosen": "dose", "flasche": "flasche", "flaschen": "flasche",
        "beutel": "beutel", "tüte": "beutel", "tüten": "beutel", "glas": "glas", "gläser": "glas",
        "bund": "bund", "paar": "paar", "rolle": "rolle", "rollen": "rolle",
        "tafel": "tafel", "tafeln": "tafel", "scheibe": "scheibe", "scheiben": "scheibe"
    };
    return map[u] || null;
}

function parseNumberRaw(x) {
    if (!x) return null;
    var n = Number(String(x).replace(",", "."));
    return isNaN(n) ? null : n;
}

function parseItemQuery(q) {
    var queryStr = (q || "").trim();
    if (!queryStr) return { name: null, menge: 1, einheit: null };
    var tokens = queryStr.split(/\s+/);
    var menge = 1;
    var einheit = null;
    var nameTokens = tokens;

    var n = parseNumberRaw(tokens[0]);
    if (n !== null) {
        menge = n;
        nameTokens = tokens.slice(1);
        if (nameTokens.length > 0) {
            var unitCandidate = normalizeUnit(nameTokens[0]);
            if (unitCandidate) {
                einheit = unitCandidate;
                nameTokens = nameTokens.slice(1);
            }
        }
    }
    return { name: nameTokens.join(" ").trim() || queryStr, menge: menge, einheit: einheit };
}

// ---------- Handlers ----------

var FinishIntentHandler = {
    canHandle: function (hi) {
        if (Alexa.getRequestType(hi.requestEnvelope) !== "IntentRequest") return false;
        var n = Alexa.getIntentName(hi.requestEnvelope);
        var slots = getSlots(hi);
        var q = (getSlotValue(slots, "query") || "").toLowerCase();
        var f = (getSlotValue(slots, "foodName") || "").toLowerCase();
        return n === "FinishIntent" || n === "AMAZON.StopIntent" ||
            n === "AMAZON.CancelIntent" || q === "fertig" || f === "fertig";
    },
    handle: function (hi) {
        return hi.responseBuilder
            .speak("Alles klar, bis zum nächsten Mal!")
            .withShouldEndSession(true)
            .getResponse();
    }
};

var GetMenuIntentHandler = {
    canHandle: function (hi) {
        return Alexa.getRequestType(hi.requestEnvelope) === "IntentRequest" &&
            Alexa.getIntentName(hi.requestEnvelope) === "GetMenuIntent";
    },
    handle: async function (hi) {
        var token = getAccessToken(hi);
        if (!token) return handleNoAccount(hi);

        var slots = getSlots(hi);
        var tag = (getSlotValue(slots, "tag") || "heute").toLowerCase();
        var artRaw = getSlotValue(slots, "art");
        var art = artRaw ? artRaw.toLowerCase() : null;

        try {
            var data = await postJson("menu", { tag: tag, art: art }, token);
            var gericht = data.text || data.card || data.gericht || data.name;
            var antwort = gericht ? gericht : "Dazu habe ich keinen Eintrag gefunden.";

            return hi.responseBuilder
                .speak(antwort)
                .withShouldEndSession(true)
                .getResponse();
        } catch (e) {
            return hi.responseBuilder
                .speak("Ich konnte den Menüplan gerade nicht abrufen.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};

var LaunchRequestHandler = {
    canHandle: function (hi) { return Alexa.getRequestType(hi.requestEnvelope) === "LaunchRequest"; },
    handle: function (hi) {
        var token = getAccessToken(hi);
        if (!token) return handleNoAccount(hi);

        return hi.responseBuilder
            .speak("Gabel Guru ist bereit. Was soll auf die Liste?")
            .reprompt("Soll ich etwas aufschreiben?")
            .getResponse();
    }
};

var AddItemIntentHandler = {
    canHandle: function (hi) {
        return Alexa.getRequestType(hi.requestEnvelope) === "IntentRequest" &&
            Alexa.getIntentName(hi.requestEnvelope) === "AddItemIntent";
    },
    handle: async function (hi) {
        var token = getAccessToken(hi);
        if (!token) return handleNoAccount(hi);

        var slots = getSlots(hi);
        var foodName = getSlotValue(slots, "foodName");
        var query = getSlotValue(slots, "query");
        var requestId = hi.requestEnvelope.request.requestId;

        var checkName = (foodName || query || "").toLowerCase();
        if (checkName.indexOf("fertig") !== -1 || checkName === "beenden") {
            return FinishIntentHandler.handle(hi);
        }

        var finalPayload = null;
        if (foodName) {
            finalPayload = {
                name: foodName,
                menge: parseNumberRaw(getSlotValue(slots, "menge")) || 1,
                einheit: normalizeUnit(getSlotValue(slots, "einheit")),
                requestId: requestId, source: "alexa", mode: "food"
            };
        } else if (query) {
            var parsed = parseItemQuery(query);
            finalPayload = {
                name: parsed.name, menge: parsed.menge, einheit: parsed.einheit,
                requestId: requestId, source: "alexa", mode: "query"
            };
        }

        if (finalPayload && finalPayload.name) {
            try {
                await postJson("add", finalPayload, token);
                var ansageTeil = "";
                if (finalPayload.menge && finalPayload.menge !== 1) ansageTeil += finalPayload.menge + " ";
                if (finalPayload.einheit) ansageTeil += finalPayload.einheit + " ";

                return hi.responseBuilder
                    .speak("Ok, " + ansageTeil + finalPayload.name + " ist notiert. Was noch?")
                    .reprompt("Möchtest du noch etwas hinzufügen? Oder sag 'fertig'.")
                    .getResponse();
            } catch (e) {
                return hi.responseBuilder.speak("Die Liste ist gerade nicht erreichbar.").getResponse();
            }
        }
        return hi.responseBuilder.speak("Was soll auf die Liste?").getResponse();
    }
};

function containsFinishWord(obj) {
    var stopWords = ["fertig", "beenden", "stopp", "abbrechen", "das war's", "nichts mehr", "aufhören", "ende"];
    var str = JSON.stringify(obj).toLowerCase();
    return stopWords.some(function (word) {
        return str.indexOf(word) !== -1;
    });
}

var ErrorHandler = {
    canHandle: function () { return true; },
    handle: function (hi, error) {
        console.log("CRITICAL ERROR LOG:", error);
        if (containsFinishWord(hi.requestEnvelope)) {
            return hi.responseBuilder
                .speak("Alles klar, bis zum nächsten Mal!")
                .withShouldEndSession(true)
                .getResponse();
        }
        return hi.responseBuilder
            .withShouldEndSession(true)
            .getResponse();
    }
};

// ---------- Registrierung ----------
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        FinishIntentHandler,
        GetMenuIntentHandler,
        AddItemIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
