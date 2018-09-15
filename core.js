const fetch = require('node-fetch')
const { resolve } = require('url')
const jsdom = require('jsdom')

const DEFAULT_PROFILE_URL = 'https://femiwiki.com/fw-resources/kakaotalk/profile_anonymous.png'

module.exports = async URL => {
  const res = await fetch(URL)
  const html = await res.text()
  const doc = await parseHTML(html)

  const [talkTableEl, participantsTableEl] = doc.querySelectorAll('.wikitable')
  const rows = table2array(talkTableEl, {})
  const participants = table2array(
    participantsTableEl,
    { '이미지': el => resolve(URL, el.querySelector('img').src) }
  )

  const participantsMap = {}
  for (const p of participants) {
    participantsMap[p['대화명']] = p
  }

  return render(rows, participantsMap)
}


function parseHTML(html) {
  return new Promise((resolve, reject) =>
    jsdom.env(html, (err, window) =>
      resolve(window.document)
    )
  )
}

function table2array(tableEl, accessors) {
  if (!tableEl) { return [] }

  // Extract keys from THs
  const keys = [...tableEl.querySelector('tr').querySelectorAll('th, td')]
    .map(h => h.innerHTML.trim())

  // Extract values from TDs
  const objs = []
  for (const trEl of tableEl.querySelectorAll('tr')) {
    const tdEls = trEl.querySelectorAll('td')
    if (tdEls.length === 0) { continue }

    const obj = {}
    for (let j = 0; j < tdEls.length; j++) {
      const key = keys[j]
      const accessor = accessors[key] || (el => el.innerHTML.trim())

      obj[key] = accessor(tdEls[j])
    }
    objs.push(obj)
  }
  return objs
}

function render(rows, participantsMap) {
  let result = `\
<!DOCTYPE html>
<html>
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://femiwiki.com/fw-resources/kakaotalk/kakaotalk.css">
</head>
<body>

<div class="kakaotalk">
<ul>
`

  let prevSender = null
  for (const row of rows) {
    result += render_talk(row, prevSender, participantsMap[row['대화명']] || {})
    prevSender = row['대화명']
  }

  result += `\
</ul>
</div>

</body>
</html>
`

  return result
}

function render_talk(row, prevSender, participant) {
  const noti = row['알림']
  if (noti) {
    return `<li class="notification">${noti}</li>`
  }

  const check = row['읽음표시']
  const time = row['시간']
  const profileUrl = participant['이미지'] || DEFAULT_PROFILE_URL
  const message = row['메시지']
  const name = row['대화명']
  const is_continued = prevSender === name ? ' continued' : ''
  const is_me = row['대화명'] === '나'

  const html_info = `\
<span class="info">
  <span class="read">${check}</span>
  <span class="time">${time}</span>
</span>
`
  const html_message = `<span class="message">${message}</span>`
  const html_talk = is_me ? html_info + html_message : html_message + html_info

  return `\
<li class="talk sender-${name}${is_continued}">
  <span class="profile"><img src="${profileUrl}"></span>
  <span class="sender">${name}</span>
  ${html_talk}
</li>
`
}
