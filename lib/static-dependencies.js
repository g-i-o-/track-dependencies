#! /usr/bin/env nodejs

var fs = require('fs');
var path = require('path');
var _module = require('module');
var async = require('async');
var codebase_entry = require('./codebase_entry');

var static_dependencies = {
    walk : function(basepath, loop, done){
        fs.stat(basepath, function(err, stat){
            if(err){
                done(err);
            } else if(stat.isFile()){
                loop(basepath, done);
            } else if(stat.isDirectory()){
                fs.readdir(basepath, function(err, subfiles){
                    if(err){
                        done(err);
                    } else {
                        var subpaths=subfiles.map(function(subfile){
                            return path.join(basepath, subfile);
                        });
                        async.eachSeries(subpaths, function(subpath, next_iter){
                            static_dependencies.walk(subpath, loop, next_iter);
                        }, done);
                    }
                });
            } else {
                done(new Error("Invalid basepath "+basepath+". It is neither file nor folder."));
            }
        });
    },
    extract_dependencies : function(filename, yield_fn, done){
        fs.readFile(filename, "ascii", function(err, data){
            if(err){
                done(err);
            } else {
                data = data.replace(/\/\/.*/g, '');
                data = data.replace(/\/\*([^*]|\*)*?\*\//g, '');
                var re_require=/require\(('(.+?)'|"(.+?)")\)/g, match;
                async.whilst(
                    function(){
                        return !!(match=re_require.exec(data));
                    }, 
                    function(next_iter){
                        yield_fn(match[2] || match[3], next_iter);
                    },
                    done
                );
            }
        });
    },
    resolve_dep : function(dep, file){
        if(dep.split('/').length == 1){
            return ["module", dep];
        }
        
        var deppath = path.normalize(path.join(path.dirname(file), dep));
        try{
            var absfile = _module._resolveFilename(deppath);
            var depfile = absfile;
            return ["file", depfile];
        } catch(e){
            var depjspath = deppath + '.js';
            var depindexpath = path.join(deppath, 'index.js');
            var stat={};
            try{ stat.dep = fs.statSync(deppath); } catch(e){}
            if(stat.dep && stat.dep.isDirectory()){
                try{ stat.index = fs.statSync(depindexpath); } catch(e){}
                if(stat.index && stat.index.isFile()){
                    return ["file", depindexpath];
                }
            }
            try{ stat.js = fs.statSync(depjspath); } catch(e){}
            if(stat.js && stat.js.isFile()){
                return ["file", depjspath];
            }
        }
        
        return ["unresolved", deppath];
    },
    entry_uid_counter : 0,
    analyse : function(fileset, callback){
        var codebase = {};
        async.eachSeries(fileset, function(walk_root, next_walk_root_iter){
            static_dependencies.walk(walk_root, function(file, next_file_iter){
                if(/\.js$/.test(file) || file == walk_root){
                    var dependencies;
                    if(!codebase[file]){
                        dependencies = [];
                        var ftype = (file == walk_root) ? 'root' : 'file';
                        codebase[file] = new codebase_entry(file, ftype, dependencies);
                    } else {
                        dependencies = codebase[file].dependencies;
                    }
                    //# print file
                    static_dependencies.extract_dependencies(file, function(dep, next_dep_iter){
                        var rdep = static_dependencies.resolve_dep(dep, file);
                        var dep_type = rdep[0], dep_file = rdep[1];
                        // # print "  ({}) {}".format(dep_type, dep_file)
                        dependencies.push(dep_file);
                        if(!codebase[dep_file]){
                            codebase[dep_file] = new codebase_entry(dep_file, dep_type);
                        }
                        next_dep_iter();
                    }, next_file_iter);
                } else {
                    next_file_iter();
                }
            }, function(err){
                next_walk_root_iter(err);
            });
        }, function(err){
            if(err){
                callback(err);
            } else {
                callback(null, codebase);
            }
        });
    }
};

module.exports = static_dependencies;
