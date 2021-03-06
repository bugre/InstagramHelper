/* globals alert, $, instaDefOptions, instaMessages, instaTimeout, instaCountdown */
/* exported FetchUsers */
/* jshint -W106 */

var FetchUsers = function (settings) {

  'use strict';

  var {
		obj,
    myData,
    htmlElements,
    updateStatusDiv,
    resolve
	} = settings;

  var successFetch = function (res) {
    // console.log("successFetch", this);
    obj.receivedResponses += 1;
    var data = res.data.user[Object.keys(res.data.user)[0]];
    updateStatusDiv(`received users - ${data.edges.length} (${obj.relType}/${obj.receivedResponses})`);
    for (let i = 0; i < data.edges.length; i++) {
      var found = false;
      if (obj.checkDuplicates) { //only when the second run happens (or we started with already opened result page)
        for (let j = 0; j < myData.length; j++) {
          if (data.edges[i].node.username === myData[j].username) {
            found = true;
            myData[j]['user_' + obj.relType] = true;
            break;
          }
        }
      }
      if (!(found)) {
        data.edges[i].node.user_follows = false; //explicitly set the value for correct search
        data.edges[i].node.user_followed_by = false; //explicitly set the value for correct search
        data.edges[i].node['user_' + obj.relType] = true;
        myData.push(data.edges[i].node);
      }
    }
    updateProgressBar(obj, data.edges.length);

    if (data.page_info.has_next_page) { //need to continue
      obj.end_cursor = data.page_info.end_cursor;
      setTimeout(() => this.fetchInstaUsers(), calculateTimeOut(obj));
      return;
    }
    htmlElements[obj.relType].asProgress('finish').asProgress('stop'); //stopProgressBar(obj);
    if (obj.callBoth) {
      obj.end_cursor = null;
      obj.relType = obj.relType === 'follows' ? 'followed_by' : 'follows';
      obj.callBoth = false;
      obj.checkDuplicates = true;
      setTimeout(() => this.fetchInstaUsers(), calculateTimeOut(obj));
      return;
    }
    resolve(obj);
  };

  var retryError = function () {
    console.log('HTTP error', new Date());
    updateStatusDiv(instaMessages.getMessage('HTTP429', +instaDefOptions.retryInterval / 60000), 'red');
    instaTimeout.setTimeout(3000)
      .then(function () {
        return instaCountdown.doCountdown('status', '', (new Date()).getTime() + +instaDefOptions.retryInterval);
      })
      .then( () => {
        console.log('Continue execution after HTTP error', new Date());
        this.fetchInstaUsers();
      });
  };

  var errorFetch = function (jqXHR, exception) {
    console.log('error ajax');
    //todo: handle 502?
    console.log(arguments);
    if (jqXHR.status === 0) {
      setTimeout(() => this.fetchInstaUsers(), instaDefOptions.retryInterval);
      alert(instaMessages.getMessage('NOTCONNECTED', +instaDefOptions.retryInterval / 60000));
    } else if (jqXHR.status === 429) {
      console.log('HTTP429 error.', new Date());
      this.retryError();
    } else if (jqXHR.status === 404) {
      alert(instaMessages.getMessage('HTTP404'));
    } else if (jqXHR.status === 500) {
      alert(instaMessages.getMessage('HTTP500'));
    } else if (exception === 'parsererror') {
      alert(instaMessages.getMessage('JSONPARSEERROR'));
    } else if (exception === 'timeout') {
      alert(instaMessages.getMessage('TIMEOUT'));
    } else if (exception === 'abort') {
      alert(instaMessages.getMessage('AJAXABORT'));
    } else {
      alert(instaMessages.getMessage('UNCAUGHT', jqXHR.responseText));
    }
  };


  var fetchInstaUsers = function () {

    $.ajax({
      url: 'https://www.instagram.com/graphql/query',
      data: {
        query_id: instaDefOptions.queryId[obj.relType],
        id: obj.userId,
        first: obj.pageSize,
        after: obj.end_cursor ? obj.end_cursor : null
      },
      context: this,
      method: 'GET',
      headers: {
        'X-CSRFToken': obj.csrfToken,
        'eferer': 'https://www.instagram.com/' + obj.userName + '/'
      },
      success: successFetch,
      error: errorFetch
    });
  };

  function calculateTimeOut(obj) {
    if (instaDefOptions.noDelayForInit && (obj.receivedResponses < instaDefOptions.requestsToSkipDelay)) {
      return 0;
    }
    return obj.delay;
  }

  function updateProgressBar(obj, count) {
    var newValue = 0 + obj[obj.relType + '_processed'] + count;
    htmlElements[obj.relType].asProgress('go', newValue);
    obj[obj.relType + '_processed'] = newValue;
  }

  return {
    fetchInstaUsers: fetchInstaUsers,
    retryError: retryError
  };

};
