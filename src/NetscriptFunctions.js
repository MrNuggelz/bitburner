/* Netscript Functions 
 * Implementation for Netscript features */
function netscriptArray(exp, workerScript) {
    var env = workerScript.env;
    var arr = env.get(exp.value);
    return new Promise(function(resolve, reject) {
        if (exp.index == null || exp.index == undefined) {
            if ((exp.op.type == "call" && exp.op.func.value == "length") ||
                (exp.op.type == "var" && exp.op.value == "length")) {
                return resolve(arr.length);
            } else if ((exp.op.type == "call" && exp.op.func.value == "clear") ||
                       (exp.op.type == "var" && exp.op.value == "clear")) {
                    arr.length = 0;
                    return resolve(true);
            } else if (exp.op.type == "call" && exp.op.func.value == "push") {
                if (exp.op.args.length == 1) {
                    var entry = Object.assign({}, exp.op.args[0]);
                    arr.push(entry);
                    return resolve(true);
                } else {
                    return reject(makeRuntimeRejectMsg(workerScript, "Invalid number of arguments passed into array.push() command. Takes 1 argument"));
                }
            } else {
                return reject(makeRuntimeRejectMsg(workerScript, "Invalid operation on an array"));
            }
        }
            
        //The array is being indexed
        var indexPromise = evaluate(exp.index.value, workerScript);
        indexPromise.then(function(i) {
            if (isNaN(i)) {
                return reject(makeRuntimeRejectMsg(workerScript, "Invalid access to array. Index is not a number: " + idx));
            } else if (i >= arr.length || i < 0) {
                return reject(makeRuntimeRejectMsg(workerScript, "Out of bounds: Invalid index in [] operator"));
            } else {
                if (exp.op && exp.op.type == "call") {
                    switch(exp.op.func.value) {
                        case "insert":
                            if (exp.op.args.length == 1) {
                                var entry = Object.assign({}, exp.op.args[0]);
                                arr.splice(i, 0, entry);
                                return resolve(arr.length);
                            } else {
                                return reject(makeRuntimeRejectMsg(workerScript, "Invalid number of arguments passed into array insert() call. Takes 1 argument"));
                            }
                            break;
                        case "remove":
                            if (exp.op.args.length == 0) {
                                return resolve(arr.splice(i, 1));
                            } else {
                                return reject(makeRuntimeRejectMsg(workerScript, "Invalid number of arguments passed into array remove() call. Takes 1 argument"));
                            }
                            break;
                        default:
                            return reject(makeRuntimeRejectMsg(workerScript, "Invalid call on array element: " + exp.op.func.value));
                            break;
                    }
                } else {
                    //Return the indexed element
                    var resPromise = evaluate(arr[i], workerScript);
                    resPromise.then(function(res) {
                        resolve(res);
                    }, function(e) {
                        reject(e);
                    });
                }
            }
        }, function(e) {
            reject(e);
        });
    });
}

function netscriptAssign(exp, workerScript) {
    var env = workerScript.env;
    return new Promise(function(resolve, reject) {
        if (env.stopFlag) {return reject(workerScript);}
        
        if (exp.left.type != "var") {
            return reject(makeRuntimeRejectMsg(workerScript, "Cannot assign to " + JSON.stringify(exp.left)));
        }
        
        //Assigning an element in an array
        if (exp.left.index) {
            try {
                var res = env.get(exp.left.value);
                if (res.constructor === Array || res instanceof Array) {
                    var i = 0;
                    var iPromise = evaluate(exp.left.index.value, workerScript);
                    iPromise.then(function(idx) {
                        if (isNaN(idx)) {
                            return reject(makeRuntimeRejectMsg(workerScript, "Invalid access to array. Index is not a number: " + idx));
                        } else if (idx >= res.length || idx < 0) {
                            return reject(makeRuntimeRejectMsg(workerScript, "Out of bounds: Invalid index in [] operator"));
                        } else {
                            //Clone res to be exp.right
                            i = idx;
                            res[i] = Object.assign({}, exp.right);
                            return evaluate(exp.right, workerScript);
                        }
                    }).then(function(finalRes) {
                        resolve(finalRes);
                    }).catch(function(e) {
                        return reject(e);
                    });
                } else {
                    return reject(makeRuntimeRejectMsg(workerScript, "Trying to access a non-array variable using the [] operator"));
                }
            } catch(e) {
                return reject(makeRuntimeRejectMsg(workerScript, e.toString()));
            }
        } else {
            var expRightPromise = evaluate(exp.right, workerScript);
            expRightPromise.then(function(expRight) {
                try {
                    env.set(exp.left.value, expRight);
                } catch (e) {
                    return reject(makeRuntimeRejectMsg(workerScript, "Failed to set environment variable: " + e.toString()));
                }
                resolve(false); //Return false so this doesnt cause conditionals to evaluate
            }, function(e) {
                reject(e);
            });
        }
    });
}

function netscriptBinary(exp, workerScript) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    
    var opPromises = [evaluate(exp.left, workerScript), evaluate(exp.right, workerScript)];
    return Promise.all(opPromises).then(function (ops) {
        try {
            var result = apply_op(exp.operator, ops[0], ops[1]);
            return Promise.resolve(result);
        } catch(e) {
            return Promise.reject(e);
        }
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

function netscriptHack(exp, workerScript) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    var threads = workerScript.scriptRef.threads;
    if (isNaN(threads) || threads < 1) {threads = 1;}
    
    if (exp.args.length != 1) {
        return Promise.reject(makeRuntimeRejectMsg(workerScript, "Hack() call has incorrect number of arguments. Takes 1 argument"));
    }
    var ipPromise = evaluate(exp.args[0], workerScript);
    return ipPromise.then(function(ip) {
        var server = getServer(ip);
        if (server == null) {
            workerScript.scriptRef.log("hack() error. Invalid IP or hostname passed in: " + ip + ". Stopping...");
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Invalid IP or hostname passed into hack() command"));
        }
        
        //Calculate the hacking time 
        var hackingTime = scriptCalculateHackingTime(server); //This is in seconds
        
        //No root access or skill level too low
        if (server.hasAdminRights == false) {
            workerScript.scriptRef.log("Cannot hack this server (" + server.hostname + ") because user does not have root access");
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Script crashed because it did not have root access to " + server.hostname));
        }
        
        if (server.requiredHackingSkill > Player.hacking_skill) {
            workerScript.scriptRef.log("Cannot hack this server (" + server.hostname + ") because user's hacking skill is not high enough");
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Script crashed because player's hacking skill is not high enough to hack " + server.hostname));
        }
        
        workerScript.scriptRef.log("Attempting to hack " + ip + " in " + hackingTime.toFixed(3) + " seconds (t=" + threads + ")");
        return Promise.resolve([server, hackingTime]);
    }).then(function([server, hackingTime]) {
        console.log("Hacking " + server.hostname + " after " + hackingTime.toString() + " seconds (t=" + threads + ")");
        return netscriptDelay(hackingTime* 1000).then(function() {
            if (env.stopFlag) {return Promise.reject(workerScript);}
            var hackChance = scriptCalculateHackingChance(server);
            var rand = Math.random();
            var expGainedOnSuccess = scriptCalculateExpGain(server) * threads;
            var expGainedOnFailure = (expGainedOnSuccess / 4);
            if (rand < hackChance) {	//Success!
                var moneyGained = scriptCalculatePercentMoneyHacked(server);
                moneyGained = Math.floor(server.moneyAvailable * moneyGained) * threads;
                
                //Over-the-top safety checks
                if (moneyGained <= 0) {
                    moneyGained = 0;
                    expGainedOnSuccess = expGainedOnFailure;
                }
                if (moneyGained > server.moneyAvailable) {moneyGained = server.moneyAvailable;}
                server.moneyAvailable -= moneyGained;
                if (server.moneyAvailable < 0) {server.moneyAvailable = 0;}
                
                Player.gainMoney(moneyGained);
                workerScript.scriptRef.onlineMoneyMade += moneyGained;
                workerScript.scriptRef.recordHack(server.ip, moneyGained, threads);
                Player.gainHackingExp(expGainedOnSuccess);
                workerScript.scriptRef.onlineExpGained += expGainedOnSuccess;
                console.log("Script successfully hacked " + server.hostname + " for $" + formatNumber(moneyGained, 2) + " and " + formatNumber(expGainedOnSuccess, 4) +  " exp");
                workerScript.scriptRef.log("Script SUCCESSFULLY hacked " + server.hostname + " for $" + formatNumber(moneyGained, 2) + " and " + formatNumber(expGainedOnSuccess, 4) +  " exp (t=" + threads + ")");
                server.fortify(CONSTANTS.ServerFortifyAmount * threads);
                return Promise.resolve(true);
            } else {	
                //Player only gains 25% exp for failure? TODO Can change this later to balance
                Player.gainHackingExp(expGainedOnFailure);
                workerScript.scriptRef.onlineExpGained += expGainedOnFailure;
                console.log("Script unsuccessful to hack " + server.hostname + ". Gained " + formatNumber(expGainedOnFailure, 4) + " exp");
                workerScript.scriptRef.log("Script FAILED to hack " + server.hostname + ". Gained " + formatNumber(expGainedOnFailure, 4) + " exp (t=" + threads + ")");
                return Promise.resolve(false);
            }
        });
    }).then(function(res) {
        return Promise.resolve(res);
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

function netscriptGrow(exp, workerScript) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    var threads = workerScript.scriptRef.threads;
    if (isNaN(threads) || threads < 1) {threads = 1;}
    if (exp.args.length != 1) {
        return Promise.reject(makeRuntimeRejectMsg(workerScript, "grow() call has incorrect number of arguments. Takes 1 argument"));
    }
    var ipPromise = evaluate(exp.args[0], workerScript);
    return ipPromise.then(function(ip) {
        if (env.stopFlag) {return Promise.reject(workerScript);}
        var server = getServer(ip);
        if (server == null) {
            workerScript.scriptRef.log("Cannot grow(). Invalid IP or hostname passed in: " + ip);
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Invalid IP or hostname passed into grow() command"));
        }
                                    
        //No root access or skill level too low
        if (server.hasAdminRights == false) {
            workerScript.scriptRef.log("Cannot grow this server (" + server.hostname + ") because user does not have root access");
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Script crashed because it did not have root access to " + server.hostname));
        }
        
        var growTime = scriptCalculateGrowTime(server);
        console.log("Executing grow() on server " + server.hostname + " in " + formatNumber(growTime/1000, 3) + " seconds")
        workerScript.scriptRef.log("Executing grow() on server " + server.hostname + " in " + formatNumber(growTime/1000, 3) + " seconds (t=" + threads + ")");
        
        return Promise.resolve([server, growTime]);
    }).then(function([server, growTime]) {
        if (env.stopFlag) {return Promise.reject(workerScript);}
        return netscriptDelay(growTime).then(function() {
            if (env.stopFlag) {return Promise.reject(workerScript);}
            server.moneyAvailable += (1 * threads); //It can be grown even if it has no money
            var growthPercentage = processSingleServerGrowth(server, 450 * threads);
            workerScript.scriptRef.recordGrow(server.ip, threads);
            var expGain = scriptCalculateExpGain(server) * threads;
            if (growthPercentage == 1) {
                expGain = 0;
            }
            workerScript.scriptRef.log("Available money on " + server.hostname + " grown by " 
                                       + formatNumber(growthPercentage*100 - 100, 6) + "%. Gained " + 
                                       formatNumber(expGain, 4) + " hacking exp (t=" + threads +")");            
            workerScript.scriptRef.onlineExpGained += expGain;
            Player.gainHackingExp(expGain);   
            return Promise.resolve(growthPercentage);
        }); 
    }).then(function(res) {
        return Promise.resolve(res);
    }).catch(function(e) {
        return Promise.reject(e);
    })
}

function netscriptWeaken(exp, workerScript) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    var threads = workerScript.scriptRef.threads;
    if (isNaN(threads) || threads < 1) {threads = 1;}
    if (exp.args.length != 1) {
        return Promise.reject(makeRuntimeRejectMsg(workerScript, "weaken() call has incorrect number of arguments. Takes 1 argument"));
    }
    var ipPromise = evaluate(exp.args[0], workerScript);
    return ipPromise.then(function(ip) {
        if (env.stopFlag) {return Promise.reject(workerScript);}
        var server = getServer(ip);
        if (server == null) {
            workerScript.scriptRef.log("Cannot weaken(). Invalid IP or hostname passed in: " + ip);
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Invalid IP or hostname passed into weaken() command"));
        }
                                    
        //No root access or skill level too low
        if (server.hasAdminRights == false) {
            workerScript.scriptRef.log("Cannot weaken this server (" + server.hostname + ") because user does not have root access");
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Script crashed because it did not have root access to " + server.hostname));
        }
        
        var weakenTime = scriptCalculateWeakenTime(server);
        console.log("Executing weaken() on server " + server.hostname + " in " + formatNumber(weakenTime/1000, 3) + " seconds")
        workerScript.scriptRef.log("Executing weaken() on server " + server.hostname + " in " + 
                                   formatNumber(weakenTime/1000, 3) + " seconds (t=" + threads + ")");
        
        return Promise.resolve([server, weakenTime]);
    }).then(function([server, weakenTime]) {
        if (env.stopFlag) {return Promise.reject(workerScript);}
        return netscriptDelay(weakenTime).then(function() {
            if (env.stopFlag) {return Promise.reject(workerScript);}
            server.weaken(CONSTANTS.ServerWeakenAmount * threads);
            workerScript.scriptRef.recordWeaken(server.ip, threads);
            var expGain = scriptCalculateExpGain(server) * threads;
            workerScript.scriptRef.log("Server security level on " + server.hostname + " weakened to " + server.hackDifficulty + 
                                       ". Gained " + formatNumber(expGain, 4) + " hacking exp (t=" + threads + ")");
            workerScript.scriptRef.onlineExpGained += expGain;
            Player.gainHackingExp(expGain); 
            return Promise.resolve(CONSTANTS.ServerWeakenAmount * threads);
        });
    }).then(function(res) {
        return Promise.resolve(res);
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

function netscriptRunProgram(exp, workerScript, programName) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (exp.args.length != 1) {
        return Promise.reject(makeRuntimeRejectMsg(workerScript, "Program call has incorrect number of arguments. Takes 1 argument"));
    }
    var ipPromise = evaluate(exp.args[0], workerScript);
    return ipPromise.then(function(ip) {
        if (env.stopFlag) {return Promise.reject(workerScript);}
        var server = getServer(ip);
        if (server == null) {
            workerScript.scriptRef.log("Cannot call " + programName + ". Invalid IP or hostname passed in: " + ip);
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Invalid IP or hostname passed into " + programName + " command"));
        }
        
        if (!Player.hasProgram(programName)) {
            return Promise.reject(makeRuntimeRejectMsg(workerScript, "Player does not have " + programName + " on home computer"));
        }
        
        switch(programName) {
            case Programs.NukeProgram:
                return netscriptRunNukeProgram(exp, workerScript, server);
                break;
            case Programs.BruteSSHProgram:
                return netscriptRunBrutesshProgram(exp, workerScript, server);
                break;
            case Programs.FTPCrackProgram:
                return netscriptRunFtpcrackProgram(exp, workerScript, server);
                break;
            case Programs.RelaySMTPProgram:
                return netscriptRunRelaysmtpProgram(exp, workerScript, server);
                break;
            case Programs.HTTPWormProgram:
                return netscriptRunHttpwormProgram(exp, workerScript, server);
                break;
            case Programs.SQLInjectProgram:
                return netscriptRunSqlinjectProgram(exp, workerScript, server);
                break;
            default:
                return Promise.reject(makeRuntimeRejectMsg(workerScript, "Invalid program. This is a bug please contact game dev"));
                break;
        }
    }).then(function(res) {
        return Promise.resolve(res);
    }).catch(function(e) {
        return Promise.reject(e);
    });
}

function netscriptRunNukeProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (server.openPortCount < server.numOpenPortsRequired) {
        return Promise.reject(makeRuntimeRejectMsg(workerScript, "Not enough ports opened to use NUKE.exe virus"));
    }
    if (server.hasAdminRights) {
        workerScript.scriptRef.log("Already have root access to " + server.hostname);
    } else {
        server.hasAdminRights = true;
        workerScript.scriptRef.log("Executed NUKE.exe virus on " + server.hostname + " to gain root access");
    }
    return Promise.resolve(true);
}

function netscriptRunBrutesshProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (!server.sshPortOpen) {
        workerScript.scriptRef.log("Executed BruteSSH.exe virus on " + server.hostname + " to open SSH port (22)");
        server.sshPortOpen = true; 
        ++server.openPortCount;
    } else {
        workerScript.scriptRef.log("SSH Port (22) already opened on " + server.hostname);
    }
    return Promise.resolve(true);
}

function netscriptRunFtpcrackProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (!server.ftpPortOpen) {
        workerScript.scriptRef.log("Executed FTPCrack.exe virus on " + server.hostname + " to open FTP port (21)");
        server.ftpPortOpen = true; 
        ++server.openPortCount;
    } else {
        workerScript.scriptRef.log("FTP Port (21) already opened on " + server.hostname);
    }
    return Promise.resolve(true);
}

function netscriptRunRelaysmtpProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (!server.smtpPortOpen) {
        workerScript.scriptRef.log("Executed relaySMTP.exe virus on " + server.hostname + " to open SMTP port (25)");
        server.smtpPortOpen = true; 
        ++server.openPortCount;
    } else {
        workerScript.scriptRef.log("SMTP Port (25) already opened on " + server.hostname);
    }
    return Promise.resolve(true);
}

function netscriptRunHttpwormProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (!server.httpPortOpen) {
        workerScript.scriptRef.log("Executed HTTPWorm.exe virus on " + server.hostname + " to open HTTP port (80)");
        server.httpPortOpen = true; 
        ++server.openPortCount;
    } else {
        workerScript.scriptRef.log("HTTP Port (80) already opened on " + server.hostname);
    }
    return Promise.resolve(true);
}

function netscriptRunSqlinjectProgram(exp, workerScript, server) {
    var env = workerScript.env;
    if (env.stopFlag) {return Promise.reject(workerScript);}
    if (!server.sqlPortOpen) {
        workerScript.scriptRef.log("Executed SQLInject.exe virus on " + server.hostname + " to open SQL port (1433)");
        server.sqlPortOpen = true; 
        ++server.openPortCount;
    } else {
        workerScript.scriptRef.log("SQL Port (1433) already opened on " + server.hostname);
    }
    return Promise.resolve(true);
}