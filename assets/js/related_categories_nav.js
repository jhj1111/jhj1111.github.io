document.addEventListener('DOMContentLoaded', function () {
    const categoryTitles = document.querySelectorAll('.related-posts .cat_title');

    categoryTitles.forEach(title => {
        title.addEventListener('click', () => {
            const parentBox = title.closest('.related-posts');
            const childList = parentBox.querySelector('.cat_part');
            const arrow = title.querySelector('.toggle_arrow');

            if (!childList) return;

            const isClosed = childList.style.display === 'none' || childList.style.display === '';

            if (isClosed) {
                childList.style.display = 'block';
                if (arrow) arrow.textContent = '▼';
            } else {
                childList.style.display = 'none';
                if (arrow) arrow.textContent = '▶';
            }
        });

        // 기본 접힘 상태로 초기화
        const childList = title.closest('.related-posts').querySelector('.cat_part');
        const arrow = title.querySelector('.toggle_arrow');
        if (childList && arrow) {
            childList.style.display = 'block';
            arrow.textContent = '▼';
        }
    });
});