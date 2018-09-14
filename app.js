const rp = require('request-promise-native');
const ApiBuilder = require('claudia-api-builder');
const { resolve } = require('url');
const jsdom = require('jsdom');

const DEFAULT_PROFILE_URL = 'https://femiwiki.com/fw-resources/kakaotalk/profile_anonymous.png';

function handler(request) {
  var URL = request.queryString.url;
  return rp(URL).then(html2dom).then(function(doc) {
    var tableEls = doc.querySelectorAll('.wikitable');
    var talkTableEl = tableEls[0];
    var participantsTableEl = tableEls[1];
    var rows = table2array(talkTableEl, {});
    var participants = table2array(
      participantsTableEl,
      {'이미지': function(el) {return resolve(URL, el.querySelector('img').src);}}
    );
    var participantsMap = {};
    for(var i = 0; i < participants.length; i++) {
      var p = participants[i];
      participantsMap[p['대화명']] = p;
    }
    var html = render(rows, participantsMap);
    return html;
  });
}


function html2dom(html) {
  return new Promise(function(resolve, reject) {
    jsdom.env(html, function(err, window) {
      resolve(window.document);
    });
  });
}


function table2array(tableEl, accessors) {
  if(!tableEl) return [];

  // Extract keys from THs
  var headerEls = tableEl.querySelector('tr').querySelectorAll('th, td');
  var keys = [];
  for(var i = 0; i < headerEls.length; i++) {
    keys.push(headerEls[i].innerHTML.trim());
  }

  // Extract values from TDs
  var objs = [];
  var trEls = tableEl.querySelectorAll('tr');
  for(var i = 0; i < trEls.length; i++) {
    var tdEls = trEls[i].querySelectorAll('td');
    if(tdEls.length === 0) continue;

    var obj = {};
    for(var j = 0; j < tdEls.length; j++) {
      var key = keys[j];
      var accessor = accessors[key] || function(el) {return el.innerHTML.trim();};
      var value = accessor(tdEls[j]);
      obj[key] = value;
    }
    objs.push(obj);
  };
  return objs;
}


function render(rows, participantsMap) {
  var lines = [];

  lines.push('<!DOCTYPE html><html><head>');
  lines.push('<meta charset="UTF-8">');
  lines.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  lines.push('<link rel="stylesheet" href="https://femiwiki.com/fw-resources/kakaotalk/kakaotalk.css">');
  lines.push('</head><body>');
  lines.push('<div class="kakaotalk">');
  lines.push('<ul>');
  var prevSender = null;
  for(var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if(row['알림']) {
      lines.push(render_notification(row));
    } else {
      var participant = participantsMap[row['대화명']] || {};
      lines.push(render_talk(row, prevSender, participant));
    }
    prevSender = row['대화명'];
  }
  lines.push('</ul>');
  lines.push('</div>');
  lines.push('</body></html>');

  return lines.join('\n');
}


function render_notification(row) {
  return '<li class="notification">' + row['알림'] + '</li>';
}


function render_talk(row, prevSender, participant) {
  var continued = prevSender === row['대화명'];
  var message = '<span class="message">' + row['메시지'] + '</span>';
  var info =
    '<span class="info">' +
    '  <span class="read">' + row['읽음표시'] + '</span>' +
    '  <span class="time">' + row['시간'] + '</span>' +
    '</span>';

  var profileUrl = participant['이미지'] || DEFAULT_PROFILE_URL;
  return (
    '<li class="talk sender-' + row['대화명'] + ' ' + (continued ? 'continued' : '') + '">' +
    '<span class="profile"><img src="' + profileUrl + '"></span>' +
    '<span class="sender">' + row['대화명'] + '</span>' +
    (row['대화명'] === '나' ? info + message : message + info) +
    '</li>'
  );
}


var api = new ApiBuilder();
module.exports = api;
api.get('kakaotalk', handler, { success: { contentType: 'text/html' } });
