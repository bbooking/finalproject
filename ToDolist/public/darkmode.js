document.addEventListener('DOMContentLoaded', () => {
    const darkSetting = localStorage.getItem('darkMode');
    if (darkSetting === 'on') {
        document.body.classList.add('dark-mode');
    }

    const toggleButton = document.getElementById('darkModeToggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark ? 'on' : 'off');
        });
    }
});