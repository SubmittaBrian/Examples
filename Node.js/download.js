// required modules
var request = require('request');
var fs = require('fs');

// The Submittable API endpoint
var baseUrl = 'https://api.submittable.com/';

// Your organization's Submittable API key 
var apiKey = 'YOUR API KEY';

// The absolute or relative path of the folder where you want the files saved.
// Leaving this empty will result in files being created in the current folder.
var outputFolder = "";

function go() {
  var options = {
    count: 200, // 200 is the maxumim number of records we allow for a single request
    page: 1
  };

  var processSubmissions = function(submissions) {
    for (var i = 0; i < submissions.items.length; i++) {
      downloadSubmissionFiles(submissions.items[i]);
    }

    // keep getting more submissions until we've grabbed all the pages
    if (options.page < submissions.total_pages) {
      options.page++;
      getSubmissions(options, processSubmissions);
    }

    console.log("Waiting for disk operations to complete ...");
  };

  getSubmissions(options, processSubmissions);

  function getSubmissions(options, callback) {
    if (!options)
      options = {
        count: 80, // 200 is the maxumim number of records we allow for a single request
        page: 1
        /* You could also add any of the following:
			sort:
				The attribute to sort by, 'submitted', 'category', or 'submitter' (string)(optional)
			dir:
				The direction you with to sort in, 'desc' or 'asc' (string)(optional)
			status:
				The status of the submissions to return: 'new', 'inprogress', 'accepted', 'declined', 'completed', 'withdrawn'
			assignedTo:
			search:
				Submission title, author name, or submitter email address to search for (string)(optional). Only submissions matching this search in one or more of these fields will be returned.
			category_id:
				The submission category id (int)(optional). Only submissions in this category will be returned.
			*/
      };

    request
      .get({
        url: baseUrl + "/v1/submissions",
        qs: options,
        headers: {
          Authorization:
            "Basic " + new Buffer(apiKey, "utf8").toString("base64")
        }
      })
      .on("error", function(error) {
        console.log(error);
      })
      .on("data", function(data) {
        if (callback) callback(JSON.parse(data));
      });
  }

  function downloadSubmissionFiles(submission) {
    for (var i = 0; i < submission.files.length; i++) {
      var file = submission.files[i];

      // there are other ways to handle naming of files, such as using the submission id
      // or submission title ... here we are creating a folder named with the submission
      // id and inside it saving each file with its original name.
      var outputSubFolder = outputFolder + "\\" + submission.submission_id;
      var outputFilePath = outputSubFolder + "\\" + file.file_name;
      console.log(
        "Saving file " +
          file.file_name +
          " for submission " +
          submission.submission_id +
          " to " +
          outputFilePath
      );

      var outputFileStream = fs.createWriteStream(outputFilePath, {
        encoding: "binary" // without specifying the encoding, the stream is created with UTF-8, which won't work
      });

      var fileRequest = request
        .get({
          url: baseUrl + file.url,
          headers: {
            Authorization:
              "Basic " + new Buffer(apiKey, "utf8").toString("base64")
          }
        })
        .pipe(outputFileStream);
    }
  }
}

go();
