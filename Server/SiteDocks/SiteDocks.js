/**
 ****************
 * IMPORTANT NOTE: Hanger71 is for IOport supplied site docks!
 ****************
 *
 * Start-up installation instruction steps:
 * 1.  Copy <siteDockFileName>.zip.zbm into ./Server/SiteDocks/.
 * 2.  Restart the server.
 * 3.  Verify that you see the siteDock(s) loading entry in the log files.
 *
 * Note: blip.svar.flagSiteDockInstallOnStart needs to be set to true.
 */
"user strict";

function init(blip) {
		
		/**
		 * @function checkForSiteDocks
		 * @param {enum} type - Enum from blip.svar.siteDockTypes
		 * @param {boolean} flagIgnorePackages - Ignore installation of package.
		 * @callback {boolean} The state of true = error or false = success no error.
		 */
		async function checkForSiteDocks(type, flagIgnorePackages, callback) {

				let siteDockPackageNames = [];
				let siteDocksToUnpack    = [];
				let dirList              = '';
				let dirListLength        = '';
				let installedPackagesDir = '';
				let deployPackagesDir    = '';
				let siteDocksDir         = '';
				let hanger71SiteDocksDir = '';
				let siteDockTypeName     = '';

				let paramsSD = getSiteDockParams(type);

				if(!paramsSD) {

						blip.server.loggerErr('extractCmd(...) requires a type parameter of ' +
						blip.svar.siteDockTypes.hanger71 + ' or ' + blip.svar.siteDockTypes.thirdParty + '.');
						return callback(true);

				}

				switch (type) {

						case blip.svar.siteDockTypes.hanger71:

								dirList = blip.server.fs.readdirSync(blip.path.siteDockHanger71Dir);
								dirListLength = dirList.length;
								installedPackagesDir = String(blip.path.siteDockHanger71InstalledPackagesDir).split(/\//).reverse()[1];
								deployPackagesDir = String(blip.path.siteDockHanger71DeployDir).split(/\//).reverse()[1];
								siteDocksDir = String(blip.path.siteDocksDir).split(/\//).reverse()[1];
								siteDockTypeName = Object.keys(blip.svar.siteDockTypes)[blip.svar.siteDockTypes.hanger71];
								break;

						case blip.svar.siteDockTypes.thirdParty:

								dirList = blip.server.fs.readdirSync(blip.path.siteDocksDir);
								dirListLength = dirList.length;
								installedPackagesDir = String(blip.path.siteDocksInstalledPackagesDir).split(/\//).reverse()[1];
								deployPackagesDir = String(blip.path.siteDocksDeployDir).split(/\//).reverse()[1];
								framesDir = String(blip.path.siteDocksFramesDir).split(/\//).reverse()[1];
								hanger71SiteDocksDir = String(blip.path.siteDockHanger71Dir).split(/\//).reverse()[1];
								siteDockTypeName = Object.keys(blip.svar.siteDockTypes)[blip.svar.siteDockTypes.thirdParty];
								break;

						default:
						return callback(true);

				}

				if(dirList.length <= 1) {

						if(dirList[0] == installedPackagesDir) return callback(true);

				}
            
				for(let x = 0; x < dirListLength; x++) {

						if(type == blip.svar.siteDockTypes.hanger71 && (dirList[x] == deployPackagesDir || dirList[x] == installedPackagesDir ||
								dirList[x] == siteDocksDir)) continue;

						if(type == blip.svar.siteDockTypes.thirdParty && (dirList[x] == deployPackagesDir || dirList[x] == installedPackagesDir ||
								dirList[x] == framesDir || dirList[x] == hanger71SiteDocksDir)) continue;

						let ext = dirList[x].toString().split('.');

						if(ext[2] != undefined && !flagIgnorePackages) {

								if('.' + ext[1] + '.' + ext[2] == blip.svar.siteDocksPackageFileExts.zbm) {

										siteDocksToUnpack.push(ext[0]);
										blip.svar.siteDockInstancesLoading[siteDockTypeName]++;

 								}

						} else {

								let listType = blip.server.fs.lstatSync(paramsSD.path + dirList[x]);
								if(listType.isDirectory()) { blip.svar.siteDockInstancesLoading[siteDockTypeName]++; siteDockPackageNames.push(dirList[x]); }

						}
        
						if(x == dirListLength - 1) {

								if(!flagIgnorePackages && siteDocksToUnpack.length > 0) {

										extractSiteDockArchives(type, blip.svar.siteDocksPackageFileExts.zbm, siteDocksToUnpack, function(error) {

												if(error) { blip.server.loggerErr(error); return callback(true); }

												runPostExtractValidateSiteDocks();

										});
								}

								let success = await runValidateSiteDocks(siteDockPackageNames);
								if(siteDocksToUnpack.length == 0 ) callback(success);

						}

				}

				async function runPostExtractValidateSiteDocks() {

						callback(await runValidateSiteDocks(siteDocksToUnpack));

				}

				async function runValidateSiteDocks(dockBatch) {

						await validateSiteDocks(type, dockBatch, function(error, availSiteDocks) {

								if(error) return true;

								if(availSiteDocks != null) blip.templateAssembler.loadFramework(type, availSiteDocks);

								return false;

						});

				}

		}

		function extractionValidation(source, dest, callback) {

				var yauzl = blip.server.yauzl;
				var filesToCheck = [];

				yauzl.open(source, function(error, archiveFile) {

						if (error) return callback(error);

						archiveFile.on("error", function(error) {

								return callback(error);

						});

						archiveFile.on("entry", function(entry) {

								filesToCheck.push(entry.fileName);

						});

						archiveFile.on("end", function() {

								verifyFilesExists();

						});

				});

				function verifyFilesExists() {

						var cntr = filesToCheck.length - 1;
						var tries = blip.svar.siteDocksPackageExtractTimeout;
						var delay = blip.svar.siteDocksPackageExtractCheckDelay;

						checkFile();

						function checkFile() {

								var fileToCheck = dest + filesToCheck[cntr];

								blip.server.fs.stat(fileToCheck, function(error, stats) {

										if(error) {

												if( tries <= 0 ) {

														return callback("Archive extraction verification timed out for: " + source);

												} else {

														tries--;
														setTimeout(function() {return checkFile()}, delay);

												}

										} else {

												if( cntr <= 0 ) {

														return callback(null);

												} else {

														cntr--;
														return checkFile();

												}
										}

								});

						}

				}

		}

		function extractCmd(type, source, dest, callback) {

				let paramsSD = getSiteDockParams(type);

				if(!paramsSD) {

						blip.server.loggerErr('extractCmd(...) requires a type parameter of ' +
						blip.svar.siteDockTypes.hanger71 + ' or ' + blip.svar.siteDockTypes.thirdParty + '.');
						return callback(true);

				}

				runExtractCmd();

				function runExtractCmd() {

						const { exec } = require("child_process");

						exec("yarn node ./Dist/extract " + source + " " + dest, (error, stdout, stderr) => {

								if (error) {
										blip.server.loggerErr(error + ', Extracting '  + paramsSD.logDesc +  ' file: ' +  source);
										return callback(true);
								}

								if (stderr) {
										blip.server.loggerErr(stderr + ', Extracting '  + paramsSD.logDesc +  ' file: ' +  source);
										return callback(true);
								}

								callback(false);

						});

				}

		}

		function extractSiteDockArchives(type, extType, archives, callback) {

				let cntr = archives.length - 1;
				if(cntr == -1) return callback(null);

				let paramsSD = getSiteDockParams(type);

				if(!paramsSD) {

						return callback('extractSiteDockArchives(..) requires a type parameter of ' +
						blip.svar.siteDockTypes.hanger71 + ' or ' + blip.svar.siteDockTypes.thirdParty + '.');

				}        

				extract();

				function extract() {

						let fileName = archives[cntr] + extType;
						let pathWithFile = paramsSD.path + fileName;

						blip.server.fs.stat(pathWithFile.slice(0, pathWithFile.length - 8), function (error) {

							  if (!error) {

								    return callback('Skipping package installation, site dock directory already exists for package: ' + pathWithFile);

							  }

							  run();

						});

						function run() {

							  if (blip.svar.flagVerbose) blip.server.loggerInfo('Extracting ' + paramsSD.logDesc + ' file: ' + fileName);

							  extractCmd(type, pathWithFile, paramsSD.path, function (error) {

								    if (error) return callback('Problem executing extraction command.');

								    runextractionValidation();

							  });

						}

						function runextractionValidation() {

								cntr--;

								extractionValidation(pathWithFile, paramsSD.path, function(error) {

										if(error) {

												return callback(error);

										}

										if(blip.svar.flagVerbose) blip.server.loggerInfo('Moving '  + paramsSD.logDesc +  ' package file: ' +  fileName + " to " + paramsSD.installedPackagesDir);
										blip.server.fs.renameSync(paramsSD.path +  fileName, paramsSD.installedPackagesDir + '/' + fileName);

										if(cntr == -1) {

												callback(null);

										} else {

												extract();

										}

								});

						}

				}

		}

		function validateSiteDocks(type, name, callback) {

				let siteDocksToLoad = [];
				let nameLength = name.length;
				let paramsSD = getSiteDockParams(type);

				if(!paramsSD) {

						blip.server.loggerErr('validateSiteDocks(...) requires a type parameter of ' +
								blip.svar.siteDockTypes.hanger71 + ' or ' + blip.svar.siteDockTypes.thirdParty + '.');
						return callback(true);

				}

				let extermalTrackCntr = 0;  // Increments inside validateIdent since the for loop creates an async race condition.

				for(let x = 0; x < nameLength; x++) {

						blip.server.fs.stat(paramsSD.path + name[x] + '/' + blip.path.siteDocksConfigFileName + '.js', function(error, stats) {

								if(error) {

										blip.server.loggerErr(error + ', Reading '  + paramsSD.logDesc +  ' configuration file: ' + name[x] + ', it doesn\'t belong in this directory.');
										return callback(true);

								}

								validateIdent(type, name[x], function(error) {                    

										if(error) {

												if(blip.svar.flagVerbose) blip.server.loggerInfo('Skipping ' + name[x] + ', validation problem.');

										} else{

												siteDocksToLoad.push({name: name[x], path: paramsSD.path + name[x] + '/' + blip.path.siteDocksConfigFileName});
												if(blip.svar.flagVerbose) blip.server.loggerInfo('Stats time of install for: ' + name[x] + ' is ' + stats.birthtime);

										}

										if(extermalTrackCntr == nameLength - 1) {                        
												callback(false, siteDocksToLoad);
										}
										
										extermalTrackCntr++;

								});

						});

				}        

		}

		/**
		 * @function validateIdent
		 * @param {string} name - The name of the site dock package.
		 * @callback {boolean} The state of true = error or false = success no error.
		 */
		async function validateIdent(type, name, callback) {

				let siteDockPath = null;
				let packageType = null;

				if(type == blip.svar.siteDockTypes.hanger71) {

						siteDockPath = blip.path.siteDockHanger71Dir;
						packageType = blip.svar.package.type.siteDockHanger71;

				} else if (type == blip.svar.siteDockTypes.thirdParty) {

						siteDockPath = blip.path.siteDocksDir;
						packageType = blip.svar.package.type.siteDock;

				}

				let criteria = await blip.utilities.getCriteriaParams(siteDockPath + name +
						blip.path.dotDockDir + blip.path.criteriaFileName);

				if(!criteria) return true;

				let paramsSD = getSiteDockParams(type);

				if(criteria.package.type != paramsSD.packageName) {

						blip.server.loggerErr('Skipping, criteria package type for ' + name + ' does not match package type.');
						return true;
				}

				let identFile = siteDockPath + name + blip.path.dotDockDir + blip.path.identifierFileName;

				criteriaVersion = criteria.package.targetPackage.version;

				let ioportBlipPackageFile = blip.path.appDir + blip.path.nodePackageFileName;

				let ioBlip = blip.server.fs.readFileSync( ioportBlipPackageFile );
				ioBlipVersion = JSON.parse(ioBlip).version;

				let orHigher = (criteriaVersion[0] == '^') ? true : false;
				let comp = blip.utilities.versionCompare(criteriaVersion, ioBlipVersion);

				if((!orHigher && comp == -1) || (comp == 1)) {

						let msg = "IOport Blip version does not match the criteria needed for " + name +
												". Please upgrade ioport-blip to version: " + criteriaVersion + " or higher.";

						if(!orHigher) {

								msg = "ioport-blip version does not match the criteria needed for " + name +
												". They must be the same at version: " + criteriaVersion;

						}

						blip.server.loggerErr(msg);
						callback(true);

				} else {

						validate();

				}

				function validate() {            

						blip.server.fs.stat(identFile, function(error, stats) {

								if(error) {

										if(blip.svar.flagVerbose)  blip.server.loggerInfo("Identifier file not found for " + name +  ".  Creating a new one.");

										processCreateIdentifierFile(function(result) {

												if(result) return callback(true);

												return validate();

										});

								} else {

										blip.utilities.verifyFileToken(criteria, function(result) {

												if(!result) return callback(true);

												callback(false);

										});

								}

						});

						async function processCreateIdentifierFile(callback) {

								let token = await blip.utilities.createIdentifierFile(criteria.package.ident.serial, criteria.package.ident.salt,
										siteDockPath + name + blip.path.dotDockDir + blip.path.identifierFileName);

								if(token === true) return callback(true);

								await blip.utilities.updateRegistry(packageType, token, name);

								callback(false);

						}

				}

		}

		/**
		 * @function getSiteDockParams
		 * @param {number} type - Type of site dock.
		 * @borrows blip.svar.siteDockTypes as type
		 * @returns {object || boolean}
		 * @description Returns the parameters of the site dock type to be used.
		 */
		function getSiteDockParams(type) {

				switch (type) {

						case blip.svar.siteDockTypes.hanger71:
								return {
												packageName: Object.keys(blip.svar.package.type)[blip.svar.package.type.siteDockHanger71],
												path: blip.path.siteDockHanger71Dir, installedPackagesDir: blip.path.siteDockHanger71InstalledPackagesDir,
												logDesc: 'hanger71 site dock'};

						case blip.svar.siteDockTypes.thirdParty:
								return {
												packageName: Object.keys(blip.svar.package.type)[blip.svar.package.type.siteDock],
												path: blip.path.siteDocksDir, installedPackagesDir: blip.path.siteDocksInstalledPackagesDir,
												logDesc: 'site dock'};

						default:
								return false;
				}

		}

		return {checkForSiteDocks};

}

module.exports.init = init;
