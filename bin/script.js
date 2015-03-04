var static_dependencies = require('../lib/static-dependencies');

var USAGE = 
    "Computes a dependency graph for a set of javascript files.\n" +
    "  " + process.argv[0] + ' ' + process.argv[1] + " [options] folder1 [file.js [file2.js [...]]]\n" +
    "Options:\n" +
    "  --output json|graphviz set the output format of this script. (default=json)\n"
;

if(process.argv.length < 3){
    console.log(USAGE);
    process.exit();
}

var options={
    output:"json",
    fileset:[]
};

var args = process.argv.slice(2), arg;
while((arg = args.shift())){
    if(arg == '--output'){
        options.output=args.shift();
    } else {
        options.fileset.push(arg);
    }
}

var colors_by_type = {
    file: 'white',
    root: 'pink',
    module: 'lightblue'
};

var output = {
    json : function(err, codebase){
        console.log(JSON.stringify(err || codebase));
    },
    yaml : function(err, codebase){
        console.log("%YAML 1.2\n---");
        if(err){
            console.log("error: %s", err);
        } else {
            for(var i in codebase){
                var file = codebase[i];
                console.log("%s:\n  id:%s\n  name:%s\n  type:%s",
                    i, file.id, file.name, file.type
                );
                if(file.dependencies.length){
                    console.log("  dependencies:");
                    for(var d=file.dependencies, j=0, e=d.length; j < e; ++j){
                        var dep = file.dependencies[j];
                        console.log("    - %s", dep);
                    }
                }
            }
        }        
        console.log("...");
    },
    graphviz : function(err, codebase){
        var file, i, d, j, e;
        var rootgraph={isroot:true, subgraphs:{}, nodes:[]}, subgraph;
        var comps, comp;
        var graph_uid=1;
        for(i in codebase){
            file = codebase[i];
            if(file.type == "module"){
                comps = ["@modules"];
                file.graph_path = comps;
                file.base_name = file.name;
            } else {
                comps = file.name.split('/');
                file.graph_path = comps;
                file.base_name = comps.pop();
            }
            subgraph = rootgraph;
            while((comp= comps.shift())){
                subgraph = subgraph.subgraphs[comp] || (subgraph.subgraphs[comp]={id:graph_uid++,name:comp,subgraphs:{},nodes:[]});
            }
            subgraph.nodes.push(file);
        }
        console.log("digraph{");
        if(err){
            console.log("    err[label=\"%s\"];", err);
        } else {
            var fringe=[{graph:rootgraph,open:true}];
            while((comp = fringe.pop())){
                subgraph = comp.graph;
                if(comp.open){
                    if(!subgraph.isroot){
                        console.log("subgraph cluster_%s{\n  label=\"%s\";", subgraph.id, subgraph.name);
                    }
                    for(i=0,e=subgraph.nodes.length; i<e; ++i){
                        file = subgraph.nodes[i];
                        console.log("    %s[label=\"%s\",style=filled,fillcolor=%s];",
                            file.id, file.base_name, colors_by_type[file.type]
                        );
                    }
                    fringe.push({graph:subgraph, open:false});
                    for(i in subgraph.subgraphs){
                        fringe.push({graph:subgraph.subgraphs[i], open:true});
                    }
                } else {
                    if(!subgraph.isroot){
                        console.log("}");
                    }
                }
            }
            for(i in codebase){
                file = codebase[i];
                for(d=file.dependencies, j=0, e=d.length; j < e; ++j){
                    var dep = codebase[file.dependencies[j]];
                    console.log("    %s -> %s;",
                        file.id, dep.id
                    );
                }
            }
        }
        console.log("}");            
        
    }
};

static_dependencies.analyse(options.fileset, output[options.output] || output.json);
