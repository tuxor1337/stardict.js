/**
 * @license stardict.js
 * (c) 2013-2014 http://github.com/tuxor1337/stardict.js
 * License: MIT
 */
(function (GLOBAL) {
    const DEFAULT_PAD = 30;
    
    function getUintAt(arr, offs) {
        if(offs < 0) offs = arr.length + offs;
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr[j] & 0xff;
        }
        return out;
    }
    
    function readUTF8String(bytes) {
        var decoder = new TextDecoder("utf-8");
        return decoder.decode(bytes);
    }
            
    function readAsArrayBuffer(file, offset, size) {
        if(typeof offset === "undefined") offset = 0;
        if(typeof size === "undefined") size = -1;
        if(file.name.substr(-3) == ".dz") {
            var reader = new DictZipFile(
                file, jszlib_inflate_buffer
            );
            if(size >= 0)
                return reader.read(offset, size);
            else
                return reader.read(offset);
        } else {
            var reader = new FileReaderSync();
            if(size >= 0) 
               return reader.readAsArrayBuffer(
                   file.slice(offset, offset + size)
               );
            else return reader.readAsArrayBuffer(file.slice(offset));
        }
    }
    
    function readAsText(file, offset, size) {
        var buffer = readAsArrayBuffer(file, offset, size);
        return readUTF8String(new Uint8Array(buffer));
    }
    
    var StarDict = (function () {
        var cls = function(file_list) {
            var files = {},
                keywords = {
                    "version": "",
                    "bookname": "",
                    "wordcount": "",
                    "synwordcount": "",
                    "idxfilesize": "",
                    "sametypesequence": ""
                };
                
            function check_files(flist) {
                ["idx","syn","dict","ifo","rifo","ridx","rdic"]
                .forEach(function(d) {
                    files[d] = null;
                    for(var i=0; i < flist.length; i++) {
                        var fname = flist[i].name;
                        if(fname.substr(-1-d.length) == "." + d
                           || fname.substr(-4-d.length) == "." + d + ".dz") {
                            files[d] = flist[i];
                            flist.splice(i,1);
                        }
                    }
                });
                
                files["res"] = flist;
                
                if(files["dict"] == null) throw new Error("Missing *.dict(.dz) file!");
                if(files["idx"] == null) throw new Error("Missing *.idx(.dz) file!");
                if(files["ifo"] == null) throw new Error("Missing *.ifo(.dz) file!");
            }
            
            function process_ifo(text) {
                var lines = text.split("\n");
                if(lines.shift() != "StarDict's dict ifo file")
                    throw new Error("Not a proper ifo file");
                lines.forEach(function (l) {
                    w = l.split("=");
                    keywords[w[0]] = w[1];
                });
            }
            
            function process_rifo(text) {
                var lines = text.split("\n");
                if(lines.shift() != "StarDict's storage ifo file")
                    throw new Error("Not a proper rifo file");
                lines.forEach(function (l) {
                    w = l.split("=");
                    console.log("rifo: " + w[0] + "=" + w[1]);
                });
            }
            
            // this.load()
            check_files(file_list);
            process_ifo(readAsText(files["ifo"]));
            if(files["rifo"] != null) process_rifo(readAsText(files["rifo"]));
            
            this.keyword = function (key) { return keywords[key]; };
            
            this.resource = function (name) {
                name = name.replace(/^\x1E/, '').replace(/\x1F$/, '');
                function scan_resfiles() {
                    for(var f = 0; f < files["res"].length; f++) {
                        var filename = files["res"][f].name;
                        if(name == filename.substring(
                            filename.lastIndexOf("/")+1
                        )) return files["res"][f];
                    }
                    return null;
                }
                
                function scan_ridx(buffer) {
                    var view = new Uint8Array(buffer);
                    for(var i = 0, j = 0; i < view.length; i++) {
                        if(readUTF8String(view.subarray(j,i)) == name)
                            return [getUintAt(view,i+1),getUintAt(view,i+5)];
                    }
                    return null;
                }
                
                var result = scan_resfiles();
                
                if(result != null) return result;
                else if(files["ridx"] != null) {
                    var aPos = scan_ridx(readAsArrayBuffer(files["ridx"]));
                    if(aPos != null) {
                        return new Blob([
                            readAsArrayBuffer(files["rdic"], aPos[0], aPos[1])
                        ]);
                    }
                } else return null;
            };
            
            this.entry = function (dictpos) {
                var offset = dictpos[0], size = dictpos[1];
                
                function process_entry_data(buffer) {
                    var rawdata = new Uint8Array(buffer),
                        output_arr = [], is_sts = false;
                    if("" != keywords["sametypesequence"]) {
                        type_str = keywords["sametypesequence"];
                        is_sts = true;
                    };
                    while(true) {
                        if(is_sts) {
                            t = type_str[0];
                            type_str = type_str.substr(1);
                        } else {
                            t = String.fromCharCode(data[0]);
                            rawdata = rawdata.slice(1);
                        }
                        if(is_sts && "" == type_str) d = rawdata;
                        else if(t == t.toUpperCase()) {
                            end = getUIntAt(rawdata,0);
                            d = rawdata.slice(4,end+4);
                            rawdata = rawdata.slice(end+4);
                        } else {
                            end = rawdata.indexOf(0);
                            d = rawdata.slice(0,end);
                            rawdata = rawdata.slice(end+1);
                        }
                        if("mgtxykwh".indexOf(t) != -1) d = readUTF8String(d);
                        output_arr.push({"type": t, "content": d});
                        if(rawdata.length == 0 || (is_sts && type_str == ""))
                            break;
                    }
                    return output_arr;
                }
                
                return process_entry_data(
                    readAsArrayBuffer(files["dict"], offset, size)
                );
            };
            
            this.synonyms = function (options) {
                if(files["syn"] == null)  return [];
                if(typeof options === "undefined") options = {};
                
                var options_default = {
                    "count": -1,
                    "start_offset": 0,
                    "include_term": true, 
                    "include_wid": true,
                    "include_offset": false
                };
                
                for(var prop in options_default) {
                    if(typeof options[prop] === "undefined") {
                        if(prop == "count" && typeof options["start_offset"] !== "undefined")
                            options["count"] = 1;
                        else options[prop] = options_default[prop];
                    }
                }
                
                if(options["count"] < 0)
                    options["count"] = parseInt(this.keyword("synwordcount"));
                
                function create_syn_obj(view, offset) {
                    var syn_obj = {};
                    if(options["include_term"])
                        syn_obj["term"] = readUTF8String(view.subarray(0,-5));
                    if(options["include_wid"])
                        syn_obj["wid"] = getUintAt(view, -4);
                    if(options["include_offset"])
                        syn_obj["offset"] = offset;
                    return syn_obj;
                }
                
                function read_more_terms(offset, count, pad) {
                    if(typeof pad === "undefined") pad = DEFAULT_PAD;
                    if(count <= 0 || files["syn"].size <= offset) return [];
                    
                    var size = count * pad,
                        buffer = readAsArrayBuffer(files["syn"], offset, size),
                        view = new Uint8Array(buffer),
                        output_arr = [], j = 0;
                        
                    for(var i = 0; i < view.length-4 && count > output_arr.length; i++) {
                        if(view[i] == 0) {
                            output_arr.push(
                                create_syn_obj(
                                    view.subarray(j,i+5),
                                    offset + j
                                )
                            );
                            i += 5; j = i;
                        }
                    }
                    return output_arr.concat(
                        read_more_terms(offset+j, count - output_arr.length, pad+DEFAULT_PAD)
                    );
                }
                
                return read_more_terms(options["start_offset"], options["count"]);
            };
            
            this.index = function (options) {
                if(typeof options === "undefined") options = {};
                
                var options_default = {
                    "count": -1,
                    "start_offset": 0,
                    "include_term": true, 
                    "include_dictpos": true,
                    "include_offset": false
                };
                
                for(var prop in options_default) {
                    if(typeof options[prop] === "undefined") {
                        if(prop == "count" && typeof options["start_offset"] !== "undefined")
                            options["count"] = 1;
                        else options[prop] = options_default[prop];
                    }
                }
                
                if(options["count"] < 0)
                    options["count"] = parseInt(this.keyword("wordcount"));
                
                function create_idx_obj(view, offset) {
                    var idx_obj = {};
                    if(options["include_term"])
                        idx_obj["term"] = readUTF8String(view.subarray(0,-9));
                    if(options["include_dictpos"])
                        idx_obj["dictpos"] = [getUintAt(view,-8),getUintAt(view,-4)];
                    if(options["include_offset"])
                        idx_obj["offset"] = offset;
                    return idx_obj;
                }
                
                var depth = 0;
                function read_more_terms(offset, count, pad) {
                    if(typeof pad === "undefined") pad = DEFAULT_PAD;
                    if(count <= 0 || files["idx"].size <= offset) return [];
                    
                    var size = count * pad,
                        buffer = readAsArrayBuffer(files["idx"], offset, size),
                        view = new Uint8Array(buffer),
                        output_arr = [], j = 0;
                        
                    for(var i = 0; i < view.length-8 && count > output_arr.length; i++) {
                        if(view[i] == 0) {
                            output_arr.push(
                                create_idx_obj(
                                    view.subarray(j,i+9),
                                    offset + j
                                )
                            );
                            i += 9; j = i;
                        }
                    }
                    
                    return output_arr.concat(
                        read_more_terms(offset+j, count - output_arr.length, pad+DEFAULT_PAD)
                    );
                }
                
                return read_more_terms(options["start_offset"], options["count"]);
            };
        }
        
        return cls;
    })();
    
    GLOBAL.StarDict = StarDict;
}(this));

