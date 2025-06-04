
// 언어 이름 추가
window.addEventListener('DOMContentLoaded', function() {
    var codeBlocks = document.querySelectorAll('.highlighter-rouge');

    codeBlocks.forEach(function(codeBlock) {
        var highlight = codeBlock.querySelector('.highlight'); // .highlight 클래스를 포함하는 요소 선택

        if (highlight) {
            var languageClass = codeBlock.classList[0]; // 첫 번째 클래스를 언어 클래스로 가정

            var languageLabel = document.createElement('div');
            languageLabel.textContent = languageClass.substring(9); // "language-" 제거
            languageLabel.classList.add('language_label');

            codeBlock.insertBefore(languageLabel, highlight);
        }
    });
});








