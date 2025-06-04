
const articleElement = document.querySelector('.article');

const listItems_ul = articleElement.querySelectorAll('ul li');
const listItems_ol = articleElement.querySelectorAll('ol li');


const imageUrl_ul = 'https://img.icons8.com/?size=100&id=ZWwA8bv48g5i&format=png&color=000000';
const imageUrl_ol = 'https://img.icons8.com/emoji/48/pushpin-emoji.png';


listItems_ul.forEach((item, index) => {
  const imageElement = document.createElement('img');
  imageElement.setAttribute('width', '96');
  imageElement.setAttribute('height', '96');
  imageElement.src = imageUrl_ul;
  imageElement.alt = 'ghost--v1';

  item.insertBefore(imageElement, item.firstChild);
});

listItems_ol.forEach((item, index) => {

    const imageElement = document.createElement('img');
    imageElement.setAttribute('width', '96');
    imageElement.setAttribute('height', '96');
    imageElement.src = imageUrl_ol;
    imageElement.alt = 'ghost--v1';

    item.insertBefore(imageElement, item.firstChild);
});



// // .article 내부의 모든 p 요소를 선택합니다.
// const paragraphs = document.querySelectorAll('.article p');

// // 선택한 p 요소들을 순회하면서 이미지가 있는지 확인하고 가운데 정렬을 적용합니다.
// paragraphs.forEach(function(paragraph) {
//   const images = paragraph.querySelectorAll('img');
  
//   // 이미지가 하나 이상 있다면 가운데 정렬을 적용합니다.
//   if (images.length > 0) {
//     paragraph.style.textAlign = 'center';
//   }
// });








