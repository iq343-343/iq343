(function(){
    const input = document.getElementById('theme-toggle');
    if(!input) return;
    const saved = localStorage.getItem('theme-preference');
    if (saved === 'dark') {
        input.checked = true;
    } else if (saved === 'light') {
        input.checked = false;
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        input.checked = prefersDark;
    }
    input.addEventListener('change', function(){
        localStorage.setItem('theme-preference', input.checked ? 'dark' : 'light');
    });
})();
let offset = 20;
function loadMoreChannels(event) {
    event.preventDefault();

    const button = document.getElementById('loadMoreChannels');
    const loader = document.getElementById('loader');

    button.classList.add('disabled');
    loader.style.display = 'inline';

    fetch(`/api/channels?offset=${offset}&limit=20`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Сеть не в порядке');
            }
            return response.text();
        })
        .then(html => {
            if (html.trim() === '') {
                button.style.display = 'none';
            } else {
                
                document.getElementById('channelsMainContent').insertAdjacentHTML('beforeend', html);
                offset = offset + 20;
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
        })
        .finally(() => {
            button.classList.remove('disabled');
            loader.style.display = 'none';
        });
}
function loadMoreBots(event) {
    event.preventDefault();

    const button = document.getElementById('loadMoreBots');
    const loader = document.getElementById('loader');

    button.classList.add('disabled');
    loader.style.display = 'inline';

    fetch(`/api/bots?offset=${offset}&limit=20`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Сеть не в порядке');
            }
            return response.text();
        })
        .then(html => {
            if (html.trim() === '') {
                button.style.display = 'none';
            } else {
                
                document.getElementById('botsMainContent').insertAdjacentHTML('beforeend', html);
                offset = offset + 20;
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
        })
        .finally(() => {
            button.classList.remove('disabled');
            loader.style.display = 'none';
        });
}
function loadMoreChats(event) {
    event.preventDefault();

    const button = document.getElementById('loadMoreChats');
    const loader = document.getElementById('loader');

    button.classList.add('disabled');
    loader.style.display = 'inline';

    fetch(`/api/chats?offset=${offset}&limit=20`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Сеть не в порядке');
            }
            return response.text();
        })
        .then(html => {
            if (html.trim() === '') {
                button.style.display = 'none';
            } else {
                
                document.getElementById('chatsMainContent').insertAdjacentHTML('beforeend', html);
                offset = offset + 20;
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
        })
        .finally(() => {
            button.classList.remove('disabled');
            loader.style.display = 'none';
        });
}
function addResourse(event) {
    event.preventDefault();

    const button = document.getElementById('add-btn');
    const loader = document.getElementById('loader');
    const input = document.getElementById('resource-link');
    const link = input.value.trim();

    button.classList.add('disabled');
    loader.style.display = 'inline';

    fetch(`/api/add?link=${encodeURIComponent(link)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Сеть не в порядке');
            }
            return response.text();
        })
        .then(html => {
            
            document.getElementById('result-message').innerHTML =  html;
            
        })
        .catch(error => {
            console.error('Ошибка:', error);
        })
        .finally(() => {
            button.classList.remove('disabled');
            loader.style.display = 'none';
        });
}
function shareContent(title, content, url) {
    if (navigator.share) {
        const shareData = {
        title: title,
        text: content,
        url: url,
    };
    navigator.share(shareData)
        .then(() => {
            console.log('ok');
        })
        .catch((error) => {
            console.error('error:', error);
        });
    } else {
        console.log('Web Share API не поддерживается в этом браузере.');
        alert('Web Share API не поддерживается в этом браузере.');
    }
}