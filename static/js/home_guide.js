document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.guide-carousel');
    if (!carousel) {
        return;
    }

    const slides = [...carousel.querySelectorAll('[data-guide-slide]')];
    const dots = [...carousel.querySelectorAll('[data-guide-dot]')];
    const status = carousel.querySelector('.guide-carousel__status');
    let currentIndex = 0;

    const showGuide = (index) => {
        currentIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => {
            slide.hidden = slideIndex !== currentIndex;
        });
        dots.forEach((dot, dotIndex) => {
            const selected = dotIndex === currentIndex;
            dot.classList.toggle('guide-dot--active', selected);
            dot.setAttribute('aria-selected', String(selected));
            dot.tabIndex = selected ? 0 : -1;
        });
        status.textContent = `(${currentIndex + 1} of ${slides.length})`;
    };

    carousel.querySelector('[data-guide-previous]').addEventListener('click', () => {
        showGuide(currentIndex - 1);
    });
    carousel.querySelector('[data-guide-next]').addEventListener('click', () => {
        showGuide(currentIndex + 1);
    });
    dots.forEach((dot) => {
        dot.addEventListener('click', () => showGuide(Number(dot.dataset.guideDot)));
    });

    showGuide(0);
});
