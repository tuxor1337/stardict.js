
var StarDict = (function () {
    var cls = function(ifo_string, idx_file
            syn_file, dict_file, res_files) {
            
        var word_list = [];
        var res = res_files;
        var synonyms = [];
        var meta_info = StarDict.parse_cfg(ifo_string);
        var dict = dict_file;
        var is_dz = false;
        
        if(dict[0] == 37 && dict[1] == 213)
            is_dz = true;
        
        this.lookup = function (word) {
            /* Look for exact matches in word list and return the dict entry
            or null, if there is no exact match. */
            return null;
        }
        
        this.lookup_fuzzy = function (expr) {
            /* Look for words starting with the same letters as expr.
            Returns a list of all approximate matches. */
            return [];
        }
    }
    
    cls.parse_cfg = function(cfg) {
        return {
            version: "",
            sametypesequence: "",
            wordcount: "",
            bookname: "",
        };
    }
    
    cls.get_uint_at = function (arr, offs) {
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr.charCodeAt(j) & 0xff;
        }
        return out;
    }
    
    cls.get_utf8_string = function (bytes) {
        var ix = 0;
        if( bytes.slice(0,3) == "\xEF\xBB\xBF") ix = 3;
        var string = "";
        for( ; ix < bytes.length; ix++ ) {
            var byte1 = bytes[ix].charCodeAt(0);
            if( byte1 < 0x80 ) {
                string += String.fromCharCode(byte1);
            } else if( byte1 >= 0xC2 && byte1 < 0xE0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0x1F)<<6)
                    + (byte2&0x3F));
            } else if( byte1 >= 0xE0 && byte1 < 0xF0 ) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                string += String.fromCharCode(((byte1&0xFF)<<12) 
                    + ((byte2&0x3F)<<6) + (byte3&0x3F));
            } else if( byte1 >= 0xF0 && byte1 < 0xF5) {
                var byte2 = bytes[++ix].charCodeAt(0);
                var byte3 = bytes[++ix].charCodeAt(0);
                var byte4 = bytes[++ix].charCodeAt(0);
                var codepoint = ((byte1&0x07)<<18) + ((byte2&0x3F)<<12)
                    + ((byte3&0x3F)<<6) + (byte4&0x3F);
                codepoint -= 0x10000;
                string += String.fromCharCode(
                    (codepoint>>10) + 0xD800,
                    (codepoint&0x3FF) + 0xDC00
                );
            }
        }
        return string;
    }
    
    return cls;
})()





