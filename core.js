const fs = require('fs')
const { resolve } = require('url')
const fetch = require('node-fetch')
const jsdom = require('jsdom')
const { Encoder } = require('b64')

const defaultPhotoPromise = new Promise((resolve, reject) => {
  const buffers = []

  fs.createReadStream('default-photo.png')
  .pipe(new Encoder())
  .on('data', buffer => buffers.push(buffer))
  .on('end', _ => resolve(Buffer.concat(buffers).toString()))
  .on('error', reject)
})

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

  return await render(rows, participantsMap)
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

async function render(rows, participantsMap, defaultPhoto) {
  let result = `\
<!DOCTYPE html>
<html>
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
  html {
    font-size: 16px;
    font-family: 'Apple SD Gothic Neo','Noto Sans CJK KR','본고딕','KoPubDotum Medium','나눔바른고딕','나눔고딕',NanumGothic,'맑은고딕','Malgun Gothic',Arial,Dotum,sans-serif;
  }

  body {
    margin: 0;
    height: 100%;
    background-color: #9bbad8;
  }

  .kakaotalk {
    height: 100%;
    margin: 0 auto;
    padding: 1rem;
  }

  p {
    margin: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style-type: none;
  }

  .talk {
    position: relative;
    margin: 1.2rem 0 0.4rem;
  }

  .talk.continued {
    margin-top: 0.4rem;
  }

  .notification {
    text-align: center;
    color: #333;
    background-color: rgba(0, 0, 0, 0.15);
    padding: 0.2rem 1rem;
    margin: 2rem 0;
    font-size: 0.8rem;
  }

  .talk .sender {
    display: block;
    padding: 0.2rem 0.1rem;
    font-size: 0.8rem;
  }

  .talk .profile {
    float: left;
    margin-right: 0.5rem;
  }
  .talk .profile > * {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 1.2rem;
  }
  .talk .profile > div {
    background-image: url(data:image/png;base64,${await defaultPhotoPromise});
    background-size: cover;
  }

  .talk .info {
    display: inline-block;
    position: relative;
    width: 3.5rem;
    height: 1rem;
    margin: 0 0.4rem;
    bottom: 0;
    color: #666;
  }

  .talk .time {
    display: block;
    position: absolute;
    top: 0.8rem;
    font-size: 0.8rem;
  }

  .talk .read {
    display: block;
    position: absolute;
    top: 0;
    font-size: 0.8rem;
    color: #fae904;
  }

  .talk .message {
    display: inline-block;
    padding: 0.5rem;
    background-color: #FFF;
    border-radius: 3px;
    max-width: calc(100% - 10rem);
  }

  .talk.sender-나 {
    text-align: right;
  }

  .talk.sender-나 .message {
    background-color: #fae904;
  }

  .talk.sender-나 .info .time,
  .talk.sender-나 .info .read {
    right: 0;
  }

  .talk.continued .sender,
  .talk.continued .profile img,
  .talk.sender-나 .profile,
  .talk.sender-나 .sender {
    display: none;
  }
  </style>
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
  const image = participant['이미지']
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

  return `\
<li class="talk sender-${name}${is_continued}">
  <span class="profile">${
    image ? `<img src="${image}">` : `<div></div>`
  }</span>
  <span class="sender">${name}</span>
  ${ is_me ? html_info + html_message : html_message + html_info }
</li>
`
}
