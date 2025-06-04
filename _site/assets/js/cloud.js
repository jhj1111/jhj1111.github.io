
function randomText(){
  const text = ["H", "L", "L", "E", "O"];
  return text[Math.floor(Math.random() * text.length)];
}

function rain(){
  const cloud = document.querySelector('.cloud');
  const e = document.createElement('div');
  let left = Math.floor(Math.random() * 230);
  let size = Math.random() * 1.3;
  let duration = Math.random() * 1;

  e.classList.add('text');
  cloud.appendChild(e);
  e.innerText = randomText();
  e.style.left = 20 + left + 'px';
  e.style.fontSize = 0.5 + size + 'em';
  e.style.animationDuration = 2 + duration + 's';

  setTimeout(() => {
    cloud.removeChild(e);
  }, 2000);
}
setInterval(() => {
  rain();
}, 80)







