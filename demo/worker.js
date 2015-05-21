
var console = {
    "log": function (str) {
        postMessage(str);
    },
    "error": function (str) {
        postMessage("Error: " + str);
    }
};

importScripts("pako_inflate.js");
importScripts("dictzip_sync.js");
importScripts("../stardict_sync.js");

onmessage = function (oEvent) {
    var files = oEvent.data;
    try {
        var dict = new StarDict(files),
            synonyms = [], index = [];
            
       var raw_synonyms = dict.synonyms({
                "include_offset": true,
                "include_wid": false,
                "include_term": false
        });
        console.log("Processing synonym offsets...");
        raw_synonyms.forEach(function (syn) {
            synonyms.push(syn.offset);
        });
        delete raw_synonyms;
        
        var raw_index = dict.index({
                "include_offset": true,
                "include_dictpos": false,
                "include_term": false
        });
        console.log("Processing index offsets...");
        raw_index.forEach(function (idx) {
            index.push(idx.offset);
        });
        delete raw_index;
        
        console.log("Retrieving some synonym...");
        var some_syn = synonyms.length/2 | 0,
            syn_obj = dict.synonyms({
                "start_offset": synonyms[some_syn] 
            })[0],
            idx = dict.index({
                "start_offset": index[syn_obj.wid]
            })[0],
            entry = dict.entry(idx.dictpos);
        console.log("Entry for " + syn_obj.term + " (" + idx.term + "):");
        entry.forEach(function (data) {
            if("mgtxykwhr".indexOf(data.type) != -1)
                console.log(data.type + ": " + data.content);
        });
    } catch (err) {
        console.error("StarDict error: " + err.message);
    }
}

