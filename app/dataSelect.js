function DataSelect() {
	this.buildDefaulted = false;

}

DataSelect.prototype.init = function() {
	var me = this;


	$('#select-species').selectize(
		{	
			create: true, 			
			valueField: 'name',
	    	labelField: 'name',
	    	searchField: ['name'],
	    	maxItems: 1,
	    	options: genomeBuildHelper.speciesList
    	}
	);
	$('#select-build').selectize(
		{
			create: true, 			
			valueField: 'name',
	    	labelField: 'name',
	    	searchField: ['name'],
	    	onOptionAdd: function(value) {
	    		if (!me.buildDefaulted) {
	    			$('#select-build')[0].selectize.addItem(genomeBuildHelper.currentBuild.name, false);
	    			me.buildDefaulted = true; 
	    			updateUrl("build", genomeBuildHelper.currentBuild.name);
	    		}
	    	}
    	}
	);
	me.addSpeciesListener();
	$('#select-species')[0].selectize.addItem(genomeBuildHelper.getCurrentSpeciesName());
	me.addBuildListener();
	me.setDefaultBuildFromData();
}

DataSelect.prototype.removeSpeciesListener = function() {
	if ($('#select-species')[0].selectize) {
		$('#select-species')[0].selectize.off('change');
	}
}

DataSelect.prototype.addSpeciesListener = function() {
	var me = this;
	if ($('#select-species')[0].selectize) {
		$('#select-species')[0].selectize.on('change', function(value) {
	        if (!value.length) {
	        	return;
	        }
	        genomeBuildHelper.setCurrentSpecies(value);
	        updateUrl("species", value);
	        var selectizeBuild = $('#select-build')[0].selectize;
	        selectizeBuild.disable();
	        selectizeBuild.clearOptions();
	        
	        selectizeBuild.load(function(callback) {
	        	selectizeBuild.enable();
	        	callback(genomeBuildHelper.speciesToBuilds[value]);
	        });
			
	    });
	}

}


DataSelect.prototype.removeBuildListener = function() {
	if ($('#select-build')[0].selectize) {
		$('#select-build')[0].selectize.off('change');
	}

}

DataSelect.prototype.addBuildListener = function() {
	var me = this;
	if ($('#select-build')[0].selectize) {
	    $('#select-build')[0].selectize.on('change', function(value) {
			if (!value.length) {
				return;
			}
			genomeBuildHelper.setCurrentBuild(value);
			updateUrl("build", value);
			$('#build-link').text(value);
			me.validateBuildFromData(function(success, message) {
				if (success) {
					$('#species-build-warning').addClass("hide");
					//window.enableLoadButton();
				} else {
					$('#species-build-warning').html(message);
					$('#species-build-warning').removeClass("hide");
					//window.disableLoadButton();
				}
			});
			
		});
	}

}


DataSelect.prototype.setDefaultBuildFromData = function() {
	var me = this;
	if ($('#select-species')[0].selectize && $('#select-build')[0].selectize) {
		me.getBuildsFromData(function(buildsInData) {
			if (buildsInData.length == 0) {
				$('#species-build-warning').addClass("hide");
				//window.enableLoadButton();

			} else if (buildsInData.length == 1) {			
				var buildInfo = buildsInData[0];
				
				me.removeBuildListener();
				genomeBuildHelper.setCurrentSpecies(buildInfo.species.name);
				genomeBuildHelper.setCurrentBuild(buildInfo.build.name);
				$('#select-species')[0].selectize.setValue(buildInfo.species.name);
				$('#select-build')[0].selectize.setValue(buildInfo.build.name);	
				me.addBuildListener();

				$('#species-build-warning').addClass("hide");				
				//window.enableLoadButton();		
			} else {
				var message = genomeBuildHelper.formatIncompatibleBuildsMessage(buildsInData);
				$('#species-build-warning').html(message);
				$('#species-build-warning').removeClass("hide");
				//window.disableLoadButton();
			}
		});		
	}

}

DataSelect.prototype.validateBuildFromData = function(callback) {
	var me = this;
	me.getBuildsFromData(function(buildsInData) {
		if (buildsInData.length == 0) {
			callback(true);

		} else if (buildsInData.length == 1) {
			var buildInfo = buildsInData[0];
			if (genomeBuildHelper.currentSpecies.name == buildInfo.species.name && genomeBuildHelper.currentBuild.name == buildInfo.build.name) {
				callback(true);
			} else {
				callback(false, 'Incompatible build. Data files specify the genome build ' + buildInfo.species.name + ' ' + buildInfo.build.name);
			}
		} else {
			callback(false, genomeBuildHelper.formatIncompatibleBuildsMessage(buildsInData));
		}
	});
}


DataSelect.prototype.getBuildsFromData = function(callback) {
	var me = this;

	me.getHeadersFromVcfs(function(vcfHeaderMap) {
		var buildsInHeaders = genomeBuildHelper.getBuildsInHeaders({}, vcfHeaderMap);
		callback(buildsInHeaders);

	});
}



DataSelect.prototype.getHeadersFromVcfs = function(callback) {
	var headerMap = {};
	vcfiobio.getHeader(function(header) {
		headerMap['proband'] = header;
		callback(headerMap);
	});
}