// required modules
var request = require('request');
var fs = require('fs');

// The Submittable API endpoint
var baseUrl = 'https://api.submittable.com/';

// Your organization's Submittable API key 
var apiKey = 'YOUR API KEY';

// The absolute or relative path of the folder where you want the files saved
var outputFolder = "C:\\Temp";


function go() {
	
	var options = 
	{
		count: 200, // 200 is the maxumim number of records we allow for a single request
		page: 1
	}
	
	var processSubmissions = function(submissions) {
		console.log({ 
			page: submissions.current_page,
			totalPages: submissions.total_pages,
			totalItems: submissions.total_items,
			itemsPerPage: submissions.items_per_page,
			items: submissions.items.length
		});

		// keep getting more submissions until we've grabbed all the pages
		if (options.page < submissions.total_pages) 
		{
			options.page++;
			getSubmissions(options, processSubmissions);
		}
		
		for(var i = 0; i < submissions.items.length; i++)
		{
			downloadSubmissionFiles(submissions.items[i]);
		}
		
		console.log("Waiting for disk operations to complete ...")
	}
	getSubmissions(options, processSubmissions);
	
	function getSubmissions(options, callback)
	{
		if (!options) options = 
		{
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
		}
		request({
			url: baseUrl + 'v1/submissions',
			qs: options,
			method: 'GET',
			headers: {
				Authorization: "Basic " + new Buffer(apiKey, "utf8").toString("base64")
			}
			
		}, function(error, response, body) {
			if(error) {
				console.log(error)
			} else {
				if(callback) callback(JSON.parse(body));
			}
		});
	}
	
	function downloadSubmissionFiles(submission)
	{
		for (var i = 0; i < submission.files.length; i++)
		{
			var file = submission.files[i];
			
			// there are other ways to handle naming of files, such as using the submission id 
			// or submission title ... here we are creating a folder named with the submission
			// id and inside it saving each file with its original name.
			var outputSubFolder = outputFolder + "\\" + submission.submission_id;
			var outputFilePath = outputSubFolder + "\\" + file.file_name;
			console.log("Saving file " + file.file_name + " for submission " + submission.submission_id + " to " + outputFilePath)
			request({
				url: baseUrl + file.url,
				method: 'GET',
				headers: {
					Authorization: "Basic " + new Buffer(apiKey, "utf8").toString("base64")
				}
			}, function(error, response, body) {
				if(error) {
					console.log(error)
				} else {
					// Create the output path if it does not exist
					if (!fs.existsSync(outputSubFolder)) {
						try {
							fs.mkdirSync(outputSubFolder);
						} catch (ex) {
							console.log(ex);
						}
					}
					// Write the content to disk using the original file name
					fs.createWriteStream(outputFilePath).write(body);
				}
			});
		}
	}
}

go();

