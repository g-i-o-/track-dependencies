var uid_counter = 0;

var codebase_entry = function(name, type, dependencies){
    if(dependencies === undefined){
        dependencies = [];
    }
    
    this.id = uid_counter++;
    this.name = name;
    this.type = type;
    this.dependencies = dependencies === undefined ? [] : dependencies;
};

module.exports = codebase_entry;
