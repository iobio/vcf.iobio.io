class MosaicSession {
  constructor() {
    this.apiVersion =  '/api/v1';
  }

  promiseInit(sampleId, source, projectId ) {
    let self = this;
    self.api = source + self.apiVersion;

    return new Promise((resolve, reject) => {
      let modelInfos = [];


      self.promiseGetSample(projectId, sampleId)
      .then( sample => {

        let theSample = sample;

        self.promiseGetFileMapForSample(projectId, sample).then(data => {
          theSample.files = data.fileMap;
        })
        .then( () => {


          var modelInfo = {
            'name':           theSample.name,
            'sample':         theSample.files.vcf ? theSample.vcf_sample_name : theSample.name,
            'vcf':            theSample.files.vcf,
            'tbi':            theSample.files.tbi == null || theSample.files.tbi.indexOf(theSample.files.vcf) == 0 ? null : theSample.files.tbi
          }

          if (theSample.files.bam != null) {
            modelInfo.bam = theSample.files.bam;
            if (theSample.files.bai) {
              modelInfo.bai = theSample.files.bai;
            }

          } else if (theSample.files.cram != null) {
            modelInfo.bam = theSample.files.cram;
            if (theSample.files.crai) {
              modelInfo.bai = theSample.files.crai;
            }
          }

          resolve(modelInfo);
        })
        .catch(error => {
          reject(error);
        })

      })
      .catch(error => {
          reject(error);
      })

    })




  }

  promiseGetProject(project_id) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.getProject(project_id)
      .done(data => {
          resolve(data);
      })
      .fail(error => {
        reject("Error getting project " + project_id + ": " + error);
      });
    });
  }



  promiseGetSample(project_id, sample_id) {
    let self = this;

    return new Promise(function(resolve, reject) {
      // Get pedigree for sample
      self.getSample(project_id, sample_id)
      .done(data => {
          resolve(data);
      })
      .fail(error => {
        reject("Error getting sample " + sample_id + ": " + error);
      })
    })
  }



  getSample(project_id, sample_id) {
    let self = this;
    return $.ajax({
      url: self.api + '/projects/' + project_id + '/samples/' + sample_id,
      type: 'GET',
      contentType: 'application/json',
      headers: {
        'Authorization': localStorage.getItem('hub-iobio-tkn')
      }
    });
  }


  promiseGetFileMapForSample(project_id, sample) {
    let self = this;
    return new Promise((resolve,reject) => {
      var promises = [];
      var fileMap = {};
      var currentSample = sample;
      self.promiseGetFilesForSample(project_id, currentSample.id)
      .then(files => {
        files.forEach(file => {
          var p = self.promiseGetSignedUrlForFile(project_id, currentSample.id, file)
          .then(signed => {
            fileMap[file.type] = signed.url;
            if (file.type == 'vcf') {
              sample.vcf_sample_name = file.vcf_sample_name;
            }
          })
          promises.push(p);
        })
        Promise.all(promises)
        .then(response => {
          resolve({'sample': sample, 'fileMap': fileMap});
        })
        .catch(error => {
          reject(error);
        })
      })
    })
  }



  promiseGetFilesForSample(project_id, sample_id) {
    let self = this;
    return new Promise((resolve,reject) => {
      self.getFilesForSample(project_id, sample_id)
      .done(response => {
        resolve(response.data);
      })
      .fail(error => {
        console.log("Unable to get files for sample " + sample_id)
        reject(error);
      })
    })
  }


  getFilesForSample(project_id, sample_id) {
    let self = this;
    return $.ajax({
      url: self.api + '/projects/' + project_id +  '/samples/' + sample_id + '/files',
      type: 'GET',
      contentType: 'application/json',
      headers: {
        'Authorization': localStorage.getItem('hub-iobio-tkn')
      }
    });
  }

  promiseGetSignedUrlForFile(project_id, sample_id, file) {
    let self = this;
    return new Promise((resolve, reject) => {
      self.getSignedUrlForFile(project_id, sample_id, file)
      .done(file => {
        resolve(file);
      })
      .fail(error => {
        reject(error);
      })
    })
  }

  getSignedUrlForFile (project_id, sample_id, file) {
    let self = this;
    return $.ajax({
      url: self.api +  '/projects/' + project_id + '/files/' + file.id + '/url',
      type: 'GET',
      contentType: 'application/json',
      headers: {
        'Authorization': localStorage.getItem('hub-iobio-tkn')
      }
    });
  }

  getProject(projectId) {
    let self = this;
    return $.ajax({
        url: self.api + '/projects/' + projectId,
        type: 'GET',
        contentType: 'application/json',
        headers: {
            'Authorization': localStorage.getItem('hub-iobio-tkn')
        }
    });
  }


}
