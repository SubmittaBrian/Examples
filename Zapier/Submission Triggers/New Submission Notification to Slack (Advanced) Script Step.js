var data = {
    submissionId: input.submissionId,
};

var headers = {
    headers: {
        "Authorization": "Basic " + new Buffer("ef49996caca942d8987653ad9a5422ea:").toString("base64")
    }
};


// Get full details about the submission 
fetch("https://api.submittable.com/v1/submissions/" + data.submissionId, headers)
    .then(function (raw) {
        return raw.json();
    })
    .then(function (submission) {
        data.submission = submission
        data.email = data.submission.submitter.email;
        data.author = data.submission.submitter.first_name + " " + data.submission.submitter.last_name;
        data.category = data.submission.category.name;
        data.publication = data.submission.category.name.split(": ")[0];
        data.title = data.submission.title;
        data.link = data.submission.link;
    })
    .then(function () {
        // These calls can be made in parallel, but we need to wait 
        // for all of them to complete before we move on.
        Promise.all([
                // Get a list of staff for the organization
                fetch("https://api.submittable.com/v1/staff", headers)
                .then(function (raw) {
                    return raw.json();
                })
                .then(function (staff) {
                    data.staff = staff;
                })
                .catch(callback),
                //
                // Get a list of all submissions from this submitter
                fetch("https://api.submittable.com/v1/submissions/?search=" + data.email, headers)
                .then(function (raw) {
                    return raw.json();
                })
                .then(function (pastSubmissions) {
                    data.pastSubmissions = pastSubmissions;
                })
                .catch(callback),
                //
                // Check for content that we may need to edit out later
                fetch("https://script.google.com/macros/s/AKfycbwyZ3mknYZ8blLOePBkexBtsuYCa6qbFrKrKXZ9d5kqNKuaayY/exec", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data.submission.files[0])
                })
                .then(function (raw) {
                    return raw.json();
                })
                .then(function (blue) {
                    data.blue = blue;
                })
                .catch(callback)
            ])
            .then(function () {

                var isStaffMember = false,
                    isPastContributor = false,
                    hasTooManySubmissions = false,
                    isBlue = false,
                    noFeedback = false

                try {
                    if (data.submission && data.pastSubmissions && data.staff) {

                        // check to see whether the submitter is on staff.
                        isStaffMember = data.staff.items ?
                            data.staff.items.filter(function (item) {
                                return item.email == data.email;
                            }).length > 0 :
                            false;

                        if (data.pastSubmissions.items) {
                            // check to see whether the submitter has had submissions accepted in the past.
                            data.acceptances = data.pastSubmissions.items.filter(function (item) {
                                return item.status == "Accepted";
                            });
                            isPastContributor = data.acceptances.length > 0;

                            // check to see whether the submitter has already hit the limit for submissions in this category

                            if (categoryLimit(data.category)) {
                                var activeStatuses = ["New", "In-Progress", "Editable"];
                                data.activeSubmissions = data.pastSubmissions.items.filter(function (item) {
                                    return item.submission_id != data.submissionId &&
                                        item.category.name == data.category &&
                                        activeStatuses.indexOf(item.status) > -1

                                });
                                data.hasTooManySubmissions = data.activeSubmissions.length >= categoryLimit(data.category);
                            }
                        }

                        isBlue = data.blue && data.blue.length > 0;

                        noFeedbackCheckbox = data.submission.form.items.filter(function(item) {return item.label == "No Feedback"})[0];
                        noFeedback = noFeedbackCheckbox && noFeedbackCheckbox.data == "true";

                        // Compile notes based on what we've learned
                        var attachments = [];

                        // Zetetic is always "No Feedback" so it doesn't make sense
                        // to show a notification about it every time. It's only
                        // an option for Ember and Spark.
                        if (noFeedback && data.publication != "Zetetic") {
                            attachments.push({
                                color: "good",
                                text: "No Feedback"
                            })
                        }

                        if (isBlue) {
                            var attachment = {
                                title: "Content Warning"
                            };
                            if (data.publication == "Ember") {
                                attachment.color = "danger";
                                attachment.text = "This piece contains content that *will require editing* in order to be appropriate for our young audience.";
                            } else {
                                attachment.color = "#2d9ee0";
                                attachment.text = "This piece _may_ contain content that will require editing in order to be appropriate for our broad audience.";
                                attachment.mrkdwn_in = ["text"];
                            }
                            attachment.mrkdwn_in = ["text"];
                            attachment.fields = [{
                                title: "Keywords",
                                value: data.blue.join(", ")
                            }];
                            attachments.push(attachment);
                        }

                        if (isStaffMember) {
                            attachments.push({
                                color: "warning",
                                title: "Staff Reader",
                                text: format("{author} may be a current staff reader. Be careful when assigning this piece for review.", data)
                            });
                        }

                        if (isPastContributor) {
                            attachments.push({
                                color: "good",
                                title: "Past Contributor",
                                text: format("{author} has had work accepted by E&GJ Press in the past.", {
                                    author: data.author
                                }),
                                fields: (function () {
                                    var fields = [];
                                    for (var i = 0; i < data.acceptances.length; i++) {
                                        var acceptance = data.acceptances[i];

                                        fields.push({
                                            title: "Accepted",
                                            value: format("<{link}|{title}>", {
                                                link: acceptance.link,
                                                title: acceptance.title
                                            }),
                                            short: true

                                        });
                                    }
                                    return fields;
                                })()
                            });
                        }

                        if (data.hasTooManySubmissions) {
                            attachments.push({
                                color: "danger",
                                title: "Too Many Submissions",
                                text: format("{author} already has {count} active {category} submissions in the queue.", {
                                    author: data.author,
                                    count: data.activeSubmissions.length,
                                    category: data.category
                                }),
                                fields: (function () {
                                    var fields = [];
                                    for (var i = 0; i < data.activeSubmissions.length; i++) {
                                        var activeSubmission = data.activeSubmissions[i];

                                        fields.push({
                                            title: activeSubmission.status,
                                            value: format("<{link}|{title}>", {
                                                link: activeSubmission.link,
                                                title: activeSubmission.title
                                            }),
                                            short: true

                                        });
                                    }
                                    return fields;
                                })()
                            });
                        }


                        var notification = {
                            "username": "Submittable Notifications",
                            "channel": "#slushpile-admin",
                            "icon_url": "https://emoji.slack-edge.com/T036YRMDH/submittable/2cda547d3d7c519e.png",
                            "text": format("A new *{category}* submission has been received from <https://egjpress.submittable.com/submissions?init&search={email}|{author}> titled <{link}|{title}>.", data)
                        };

                        if (attachments.length > 0) notification.attachments = attachments;

                        callback(null, {
                            notification: JSON.stringify(notification)
                        });

                    } else {
                        callback({
                            message: "Something didn't load."
                        });
                    }
                } catch (ex) {
                    callback(ex)
                }
            })
            .catch(callback);
    })
    .catch(callback);



function categoryLimit(categoryName) {
    var categoryType = categoryName.split(" ")[1];
    switch (categoryType) {
        case "Poetry":
            return 3;
        case "Prose":
            return 1;
        default:
            return null;
    }
}

// https://github.com/Matt-Esch/string-template
// MIT Licensed
function format(string) {
    var nargs = /\{([0-9a-zA-Z_]+)\}/g
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = new Array(arguments.length - 1)
        for (var i = 1; i < arguments.length; ++i) {
            args[i - 1] = arguments[i]
        }
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}
