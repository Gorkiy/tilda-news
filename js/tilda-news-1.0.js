// Config
// Setup proper recid, feeduid and projectid from Tilda project and Feeds block to catch the news
// Inspect published page and copy-paste values
var tNewsWidget = {
    recid: 209304902,
    feeduid: '814331624834',
    projectid: '2484524',
    EN: {
        recid: 209872257,
        feeduid: '442610812815'
    },
    slice: 1,
    nextSlice: null,
    postsPerSlice: 10,
    total: null,
    loadingTimer: null,
    isLoading: false
}

function t_news_init() {
    var wrapper = $('#tc-news');
    wrapper.append(t_news_drawWidgetButton());
    wrapper.append(t_news_drawPanel());
    var content = wrapper.find('.tc-news__content');
    content.append(t_news_drawPreloaders(tNewsWidget.postsPerSlice));

    // Reset state
    tNewsWidget.slice = 1;
    tNewsWidget.total = null;
    tNewsWidget.nextSlice = null;
    tNewsWidget.isLoading = false;

    // If news panel was exposed before, load posts in 3 sec
    var news = JSON.parse(localStorage.getItem('tNews'));
    if (news && news['isEverLoaded']) {
        var mockOpts = t_news_getMockOpts(tNewsWidget.postsPerSlice, 1);
        tNewsWidget.loadingTimer = setTimeout(function () {
            t_news_loadPosts(tNewsWidget.recid, mockOpts, 1);
        }, 3000);
    }

    if (window.lazy == 'y') {
        t_lazyload_update();
    }
    t_news_addEvents();
}

function t_news_addEvents() {
    var wrapper = $('#tc-news');
    var panel = wrapper.find('.tc-news__panel');
    var content = wrapper.find('.tc-news__content');

    wrapper.find('.tc-news__widget').click(function (e) {
        t_news_onWidgetClick();
    });

    wrapper.find('.tc-news__close-panel').click(function (e) {
        t_news_closePanel();
    });

    $(document).keydown(function (e) {
        if (e.keyCode == 27 && panel.hasClass('tc-news__panel_visible') && !panel.hasClass('tc-news__panel_expanded')) {
            panel.removeClass('tc-news__panel_visible');
        }
    });

    content.on('scroll', function () {
        var height = content.height();
        var scrollTop = content.scrollTop();
        var scrollHeight = content[0].scrollHeight;
        var topPadding = 80;

        // If user scrolls down to a slightly higher than the content bottom, load posts
        if (height + scrollTop >= scrollHeight - topPadding) {
            if (!tNewsWidget.isLoading && tNewsWidget.nextSlice) {
                tNewsWidget.slice++;
                var mockOpts = t_news_getMockOpts(tNewsWidget.postsPerSlice, tNewsWidget.slice);
                t_news_loadPosts(tNewsWidget.recid, mockOpts, tNewsWidget.slice);
            }
        }
    })
}

function t_news_loadPosts(recid, opts, slice) {
    tNewsWidget.isLoading = true;
    var wrapper = $('#tc-news');
    var isFirstSlice = !slice || parseInt(slice) === 1;
    // Start with proper amount of preloading posts
    if (!isFirstSlice) {
        t_news_drawPreloaders(tNewsWidget.postsPerSlice, tNewsWidget.total);
    }

    wrapper.find('.js-feed-preloader').removeClass(
        't-feed__post-preloader__container_hidden'
    );

    var lang = t_news_returnLang();
    recid = lang === 'RU' ? tNewsWidget.recid : tNewsWidget['EN'].recid;

    var dataObj = t_news_createDataObjForRequest(
        recid,
        opts,
        isFirstSlice,
        slice
    );

    var apiUrl = 'https://feeds.tildacdn.com/api/getfeed/';
    /* inside tilda we get data from another url */
    if (!opts.isPublishedPage) {
        dataObj.projectid = tNewsWidget.projectid;
        apiUrl = 'https://tilda.cc/projects/feeds/getfeed/';
    }
    var ts = Date.now();

    $.ajax({
        type: 'GET',
        url: apiUrl,
        data: dataObj,
        dataType: 'text',
        success: function (data) {
            if (data === '') {
                tNewsWidget.isLoading = false;
                return;
            }

            try {
                var obj = JSON.parse(data);
            } catch (e) {
                tNewsWidget.isLoading = false;
                wrapper.find('.js-feed-preloader').remove();
                wrapper.find('.js-feed-container').append(
                    // t_feed_drawErrorBox(opts, data)
                );
                console.log(data);
            }

            if (typeof obj !== 'object') {
                tNewsWidget.isLoading = false;
                return;
            }

            if ('error' in JSON.parse(data)) {
                tNewsWidget.isLoading = false;
                setTimeout(function () {
                    wrapper.find('.js-feed-preloader').remove();
                    wrapper.find('.js-feed-container').append(
                        // t_feed_drawErrorBox(opts, JSON.parse(data).error)
                    );
                    console.log(JSON.parse(data).error);
                }, 500);
            }

            /* hide preloader, if it was shown */
            wrapper.find('.js-feed-preloader').addClass(
                't-feed__post-preloader__container_hidden'
            );

            var obj = JSON.parse(data);
            if (obj.total) {
                tNewsWidget.total = +obj.total;
            }

            if (isFirstSlice) {
                wrapper.find('.tc-news__feed').html('');
            }

            var news = JSON.parse(localStorage.getItem('tNews')) || {};
            news['isEverLoaded'] = true;
            localStorage.setItem('tNews', JSON.stringify(news));

            tNewsWidget.nextSlice = obj.nextslice;
            t_news_drawPosts(obj.posts, slice);
            t_news_checkUnreadPosts(obj.posts);
            tNewsWidget.isLoading = false;

            // If the next slice exists and scrollheight <= content height, load one more slice
            // We need this to fill the whole height of the content, so oncroll event for lazy load could work properly
            setTimeout(function () {
                var scrollHeight = $('.tc-news__content')[0].scrollHeight;
                var height = $('.tc-news__content')[0].offsetHeight;

                if (+slice === 1 && tNewsWidget.nextSlice && scrollHeight <= height) {
                    tNewsWidget.slice++;
                    var mockOpts = t_news_getMockOpts(tNewsWidget.postsPerSlice, tNewsWidget.slice);
                    t_news_loadPosts(tNewsWidget.recid, mockOpts, tNewsWidget.slice);
                }
            }, 1000);

        },
        error: function (xhr) {
            tNewsWidget.isLoading = false;
            var ts_delta = Date.now() - ts;
            if (xhr.status == 0 && ts_delta < 100) {
                alert(
                    'Request error (get posts). Please check internet connection...'
                );
            }
        },
        timeout: 1000 * 25
    });
}

function t_news_updatePostText(id) {
    var wrapper = $('#tc-news');
    var apiUrl = 'https://feeds.tildacdn.com/api/getpost?postuid=' + id;
    var ts = Date.now();

    var lang = t_news_returnLang();
    var recid = lang === 'RU' ? tNewsWidget.recid : tNewsWidget['EN'].recid;

    $.ajax({
        type: 'GET',
        url: apiUrl,
        data: recid,
        dataType: 'text',
        success: function (data) {
            if (data === '') {
                return;
            }

            var obj = JSON.parse(data);

            if (typeof obj !== 'object') {
                return;
            }

            if (obj.post.text.length) {
                var post = wrapper.find('[data-post-id="' + id + '"]');
                var text = post.find('.tc-news__post-text');

                if (obj.post.text.length > text.text().length) {
                    text.html(obj.post.text);
                    t_news_drawExpandButtons();
                }
            }
        },
        error: function (xhr) {
            var ts_delta = Date.now() - ts;
            if (xhr.status == 0 && ts_delta < 100) {
                alert(
                    'Request error (get posts). Please check internet connection...'
                );
            }
        },
        timeout: 1000 * 25
    });
}

function t_news_createDataObjForRequest(recid, opts, isFirstSlice, slice) {
    var size = tNewsWidget.postsPerSlice;
    var currentDate = Date.now();
    var dateFilter = opts.dateFilter;
    var obj = {
        feeduid: opts.feeduid,
        recid: recid,
        c: currentDate,
        size: size,
        slice: slice,
        sort: {
            date: opts.reverse
        },
        filters: {
            date: {}
        }
    };

    if (dateFilter === 'all') {
        obj.filters.date = '';
    } else {
        obj.filters.date[dateFilter] = 'now';
    }

    if (slice) {
        obj.slice = slice;
    }

    if (isFirstSlice) {
        obj.getparts = true;
    }

    return obj;
}

function t_news_drawWidgetButton() {
    var str = '';
    str += '<div class="tc-news__widget">';
    str += '<div class="tc-news__widget-wrap">';
    str += '<div class="tc-news__widget-counter t-text t-text_xs"></div>';
    str += '<svg class="tc-news__icon" width="36px" height="36px" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">';
    str += '<path d="M19.0365931,21.6011913 C19.446122,22.9886679 20.7298369,24.0012751 22.2500001,24.0012751 C23.8777222,24.0012751 25.2343526,22.8403049 25.5369804,21.3012751 L22.2573583,21.3012751 C22.201717,21.3025802 22.0992563,21.3059834 21.9565031,21.3123678 C21.7062877,21.3235583 21.4269375,21.3399848 21.125894,21.3626316 C20.417538,21.4159197 19.7096694,21.4941065 19.0365931,21.6011913 L19.0365931,21.6011913 Z M17.7569182,21.8535132 C17.2787018,21.9696963 16.856308,22.10221 16.5008684,22.2509126 C16.2416088,22.3593782 15.9691913,22.4970082 15.6853913,22.6621563 C14.9339276,23.0994459 14.1241813,23.7160195 13.287625,24.4650888 C12.6514835,25.0347027 12.0372915,25.6467735 11.4692996,26.258891 C11.2705707,26.4730585 11.092031,26.6716887 10.9366147,26.8495213 C10.8443298,26.9551168 10.7809254,27.0295036 10.7493097,27.0674361 C10.3600927,27.5344183 9.60000009,27.2591914 9.60000009,26.6512751 L9.60000009,5.65127514 C9.60000009,5.03237425 10.3831106,4.76368295 10.763079,5.25221374 C10.7977167,5.29674792 10.8657087,5.38271362 10.9635844,5.50415661 C11.1278137,5.70793023 11.3150334,5.93534015 11.521752,6.1804159 C12.1122365,6.88046618 12.7393784,7.58035656 13.3745463,8.23187066 C13.9060079,8.77700963 14.4195888,9.26357529 14.9053111,9.67605379 C15.517028,10.1955276 16.069494,10.5843 16.5406889,10.8198975 C17.0252732,11.0621896 17.5792669,11.2673725 18.1894007,11.4368541 C19.0744051,11.6826886 20.0299451,11.8419453 20.9866265,11.9305269 C21.3221727,11.961596 21.6334018,11.9815466 21.9118653,11.9925967 C22.0766595,11.9991362 22.192164,12.0012751 22.2500001,12.0012751 L28.2500001,12.0012751 C28.6089852,12.0012751 28.9000001,12.2922901 28.9000001,12.6512751 L28.9000001,20.6512751 C28.9000001,21.0102602 28.6089852,21.3012751 28.2500001,21.3012751 L26.8549285,21.3012751 C26.5387524,23.5616599 24.5974943,25.3012751 22.2500001,25.3012751 C20.0976594,25.3012751 18.2868193,23.838875 17.7569182,21.8535132 L17.7569182,21.8535132 Z M22.2500001,20.6512751 L22.2500001,20.0012751 L27.6000001,20.0012751 L27.6000001,13.3012751 L22.2500001,13.3012751 C22.1755059,13.3012751 22.0428912,13.2988193 21.8603185,13.2915744 C21.5598372,13.2796505 21.2259564,13.2582479 20.8667688,13.2249898 C19.8384965,13.1297794 18.8090827,12.9582104 17.8414637,12.6894274 C17.1553011,12.4988266 16.5241097,12.265052 15.9593113,11.9826528 C15.3811235,11.6935589 14.7484043,11.2483121 14.0638248,10.6669629 C13.5442768,10.2257594 13.001817,9.71183386 12.4437044,9.13935808 C11.9171857,8.59928923 11.3981258,8.02957556 10.9000001,7.45398005 L10.9000001,24.9683779 C11.3831489,24.465718 11.893491,23.9684307 12.4204243,23.496604 C13.3174633,22.6933772 14.1940679,22.025895 15.0315465,21.5385518 C15.3622658,21.3461006 15.6848821,21.1831092 15.9991338,21.0516368 C16.6531191,20.7780338 17.4567087,20.5624123 18.380444,20.3942991 C19.2263455,20.2403511 20.1277175,20.1340489 21.0283734,20.0662946 C21.3430847,20.0426195 21.6355069,20.0254244 21.8984206,20.013666 C22.0574798,20.0065523 22.172363,20.0028161 22.235804,20.0014302 L22.2500001,20.6512751 L22.2500001,20.6512751 Z M5,15.5012751 L5,16.8012751 L2,16.8012751 L2,15.5012751 L5,15.5012751 Z M5.8728502,11.2758587 L5.22284998,12.4016916 L2.62477498,10.9016916 L3.2747752,9.77585869 L5.8728502,11.2758587 Z M5.22284998,20.0883587 L5.8728502,21.2141916 L3.2747752,22.7141916 L2.62477498,21.5883587 L5.22284998,20.0883587 Z" fill="#FF8A6A"></path>';
    str += '</svg>';
    str += '</div>';
    str += '</div>';

    return str;
}

function t_news_drawPanel() {
    var str = '';
    var title = t_news_getDictionary('title');
    str += '<div class="tc-news__panel">';
    str += '<div class="tc-news__panel-wrapper">';
    str += '<div class="tc-news__feed-head">';
    str += '<div class="tc-news__close-panel">';
    str += '<svg class="tc-news__close-icon" width="18px" height="18px" viewBox="0 0 23 23" version="1.1" xmlns="http://www.w3.org/2000/svg">';
    str += '<g stroke="none" stroke-width="1" fill="#000000" fill-rule="evenodd">';
    str += '<rect transform="translate(11.313708, 11.313708) rotate(-45.000000) translate(-11.313708, -11.313708) " x="10.3137085" y="-3.6862915" width="1" height="30"></rect>';
    str += '<rect transform="translate(11.313708, 11.313708) rotate(-315.000000) translate(-11.313708, -11.313708) " x="10.3137085" y="-3.6862915" width="1" height="30"></rect>';
    str += '</g>';
    str += '</svg>';
    str += '</div>';

    str += '<div class="tc-news__title t-title t-title_sm">' + title + '</div>';
    str += '<div class="tc-news__social-bar">' + t_news_drawSocialLinks() + '</div>';
    str += '</div>';
    str += '<div class="tc-news__content">';
    str += '<div class="tc-news__feed"></div>';

    {/* <!-- preloader els --> */ }
    str += '<div class="js-feed-preloader t-feed__post-preloader_row t-feed__post-preloader__container_hidden t-container">';
    str += '</div>';
    {/* <!-- preloader els end --> */ }
    str += '</div>';
    str += '</div>';
    str += '</div>';

    return str;
}

function t_news_drawPosts(posts, slice) {
    var wrapper = $('#tc-news');
    var feed = wrapper.find('.tc-news__feed');

    if (!posts.length && +slice === 1) {
        var str = '';
        str += '<div class="tc-news__error">';
        str += '<div class="t-descr t-descr_xs">' + t_news_getDictionary('emptypartmsg') + '</div>';
        str += '</>';

        feed.append(str);
    }

    posts.forEach(function (post, i) {
        var str = '';
        var title = post.title;
        var text = post.text.length ? post.text : post.descr;
        if (!post.text.length) {
            t_news_updatePostText(post.uid);
        }

        var isImage = post.mediatype && post.mediadata.length;
        var isText = text.length;
        // We don't want to keep post url provided with each post by default
        // We show only custom links added by content manager
        var projectUrl = 'project' + tNewsWidget.projectid + '.tilda.ws';
        var isUrl = post.url.length && post.url.indexOf(projectUrl) === -1;

        str += '<div class="tc-news__post" data-post-id="' + post.uid + '">';
        str += '<div class="tc-news__post-title t-name t-name_xs">' + title + '</div>';
        if (isImage) {
            str += '<div class="tc-news__post-image">';
            str += '<img src="' + t_news_getLazyUrl(post.mediadata) + '" class="tc-news__image t-img" data-original="' + post.mediadata + '">';
            str += '</div>';
        }
        if (isText) {
            str += '<div class="tc-news__post-text t-descr t-descr_xxs">' + text + '</div>';
        }
        if (isUrl) {
            str += '<a href="' + post.url + '" class="tc-news__button tc-news__button_external t-uptitle t-uptitle_xs" target="_blank" rel="noopener noreferrer">' + t_news_getDictionary('external');
            // str += '<svg class="tc-news__post-link-icon" width="16px" height="16px" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M15,1.70710678 L7.85355339,8.85355339 C7.65829124,9.04881554 7.34170876,9.04881554 7.14644661,8.85355339 C6.95118446,8.65829124 6.95118446,8.34170876 7.14644661,8.14644661 L14.2928932,1 L8.5,1 C8.22385763,1 8,0.776142375 8,0.5 C8,0.223857625 8.22385763,0 8.5,0 L15.5,0 C15.7761424,0 16,0.223857625 16,0.5 L16,7.5 C16,7.77614237 15.7761424,8 15.5,8 C15.2238576,8 15,7.77614237 15,7.5 L15,1.70710678 L15,1.70710678 Z M12,9.5 C12,9.22385763 12.2238576,9 12.5,9 C12.7761424,9 13,9.22385763 13,9.5 L13,14.5 C13,15.3281424 12.3281424,16 11.5,16 L1.5,16 C0.671857625,16 0,15.3281424 0,14.5 L0,4.5 C0,3.67185763 0.671857625,3 1.5,3 L6.5,3 C6.77614237,3 7,3.22385763 7,3.5 C7,3.77614237 6.77614237,4 6.5,4 L1.5,4 C1.22414237,4 1,4.22414237 1,4.5 L1,14.5 C1,14.7758576 1.22414237,15 1.5,15 L11.5,15 C11.7758576,15 12,14.7758576 12,14.5 L12,9.5 Z"></path></svg>';
            str += '</a>';
        }
        str += '<div class="tc-news__post-date t-uptitle t-uptitle_xs">' + t_news_formatDate(post.date) + '</div>';
        str += '</div>';

        feed.append(str);
    })

    t_news_drawExpandButtons();

    if (window.lazy == 'y') {
        t_lazyload_update();
    }
}

function t_news_drawExpandButtons() {
    $('.tc-news__post-text').each(function () {
        var isButtonExist = $(this).closest('.tc-news__post').find('.tc-news__post-expand').length;

        if (!isButtonExist) {
            var safePadding = 20;
            var scrollHeight = $(this)[0].scrollHeight;
            var height = $(this)[0].offsetHeight + safePadding;

            if (scrollHeight > height) {
                var button = $('<div class="tc-news__post-expand t-uptitle t-uptitle_xs">' + t_news_getDictionary('expand') + '</div>');
                button.insertAfter($(this));

                button.on('click', function () {
                    var post = $(this).closest('.tc-news__post');
                    var text = post.find('.tc-news__post-text')
                    text.addClass('tc-news__post-text_expanded');
                    $(this).hide();
                })
            }
        }
    })
}

function t_news_drawUnreadCounter(count) {
    var wrapper = $('#tc-news');
    var counter = wrapper.find('.tc-news__widget-counter');
    if (count > 0) {
        counter.addClass('tc-news__widget-counter_visible');
        counter.text(count);
    } else {
        counter.removeClass('tc-news__widget-counter_visible');
    }
}

function t_news_drawSocialLinks() {
    var socialLinks = {
        fb: 'https://www.facebook.com/tildapublishing',
        twitter: 'https://twitter.com/TildaPublishing',
        vk: 'https://vk.com/tildapublishing',
        youtube: 'https://www.youtube.com/tildapublishing',
        instagram: 'https://www.instagram.com/tildapublishing/',
        telegram: 'https://telegram.me/tildanews'
    }

    var str = '';

    //Facebook
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.fb + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 48 48" enable-background="new 0 0 48 48" xml:space="preserve"><desc>Facebook</desc><path d="M21.1 7.8C22.5 6.5 24.5 6 26.4 6h6v6.3h-3.9c-.8-.1-1.6.6-1.8 1.4v4.2h5.7c-.1 2-.4 4.1-.7 6.1h-5v18h-7.4V24h-3.6v-6h3.6v-5.9c.1-1.7.7-3.3 1.8-4.3z"></path></svg>';
    str += '</a>';
    str += '</div>';

    //Twitter
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.twitter + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 48 48" enable-background="new 0 0 48 48" xml:space="preserve"><desc>Twitter</desc><path d="M41.8 12.7c-1.3.6-2.8 1-4.2 1.1 1.5-1 2.6-2.3 3.2-4-1.5.8-2.9 1.5-4.7 1.8-1.3-1.5-3.2-2.3-5.3-2.3-4 0-7.3 3.2-7.3 7.3 0 .6 0 1.1.2 1.6-6-.3-11.3-3.2-15.1-7.6-.6 1.1-1 2.3-1 3.7 0 2.6 1.3 4.7 3.2 6-1.1 0-2.3-.3-3.2-1v.2c0 3.6 2.4 6.5 5.8 7.1-.6.2-1.3.3-1.9.3-.5 0-1 0-1.3-.2 1 2.9 3.6 5 6.8 5-2.4 1.9-5.7 3.1-9.1 3.1-.6 0-1.1 0-1.8-.2 3.2 2.1 7 3.2 11.2 3.2 13.4 0 20.7-11 20.7-20.7v-1c1.7-.7 2.8-2 3.8-3.4z"></path></svg>';
    str += '</a>';
    str += '</div>';

    //Vk
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.vk + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 48 48" enable-background="new 0 0 48 48" xml:space="preserve"><desc>VK</desc><path d="M41.2 22.2c.6-.8 1.1-1.5 1.5-2 2.7-3.5 3.8-5.8 3.5-6.8l-.2-.2c-.1-.1-.3-.3-.7-.4-.4-.1-.9-.1-1.5-.1h-7.2c-.2 0-.3 0-.3.1 0 0-.1 0-.1.1v.1c-.1 0-.2.1-.3.2-.1.1-.2.2-.2.4-.7 1.9-1.5 3.6-2.5 5.2-.6 1-1.1 1.8-1.6 2.5s-.9 1.2-1.2 1.5c-.3.3-.6.6-.9.8-.2.3-.4.4-.5.4-.1 0-.3-.1-.4-.1-.2-.1-.4-.3-.5-.6-.1-.2-.2-.5-.3-.9 0-.4-.1-.7-.1-.9v-1.1-1-1.9c0-.7 0-1.2.1-1.6v-1.3c0-.4 0-.8-.1-1.1-.1-.3-.1-.5-.2-.7-.1-.2-.3-.4-.5-.6-.2-.1-.5-.2-.8-.3-.8-.2-1.9-.3-3.1-.3-2.9 0-4.7.2-5.5.6-.3.2-.6.4-.9.7-.3.3-.3.5-.1.6.9.1 1.6.5 2 1l.1.3c.1.2.2.6.3 1.1.1.5.2 1.1.2 1.7.1 1.1.1 2.1 0 2.9-.1.8-.1 1.4-.2 1.9-.1.4-.2.8-.3 1.1-.1.3-.2.4-.3.5 0 .1-.1.1-.1.1-.1-.1-.4-.1-.6-.1-.2 0-.5-.1-.8-.3-.3-.2-.6-.5-1-.9-.3-.4-.7-.9-1.1-1.6-.4-.7-.8-1.5-1.3-2.4l-.4-.7c-.2-.4-.5-1.1-.9-1.9-.4-.8-.8-1.6-1.1-2.4-.1-.3-.3-.6-.6-.7l-.1-.1c-.1-.1-.2-.1-.4-.2s-.3-.1-.5-.2H3.2c-.6 0-1.1.1-1.3.4l-.1.1c0 .1-.1.2-.1.4s0 .4.1.6c.9 2.2 1.9 4.3 3 6.3s2 3.6 2.8 4.9c.8 1.2 1.6 2.4 2.4 3.5.8 1.1 1.4 1.8 1.7 2.1.3.3.5.5.6.7l.6.6c.4.4.9.8 1.6 1.3.7.5 1.5 1 2.4 1.5.9.5 1.9.9 3 1.2 1.2.3 2.3.4 3.4.4H26c.5 0 .9-.2 1.2-.5l.1-.1c.1-.1.1-.2.2-.4s.1-.4.1-.6c0-.7 0-1.3.1-1.8s.2-.9.4-1.2c.1-.3.3-.5.5-.7.2-.2.3-.3.4-.3.1 0 .1-.1.2-.1.4-.1.8 0 1.3.4s1 .8 1.4 1.3c.4.5 1 1.1 1.6 1.8.6.7 1.2 1.2 1.6 1.5l.5.3c.3.2.7.4 1.2.5.5.2.9.2 1.3.1l5.9-.1c.6 0 1-.1 1.4-.3.3-.2.5-.4.6-.6.1-.2.1-.5 0-.8-.1-.3-.1-.5-.2-.6-.1-.1-.1-.2-.2-.3-.8-1.4-2.2-3.1-4.4-5.1-1-.9-1.6-1.6-1.9-1.9-.5-.6-.6-1.2-.3-1.9.3-.5 1-1.5 2.2-3z"></path></svg>';
    str += '</a>';
    str += '</div>';

    //YouTube
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.youtube + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 48 48" enable-background="new -455 257 48 48" xml:space="preserve"><desc>Youtube</desc><path d="M43.9 15.3c-.4-3.1-2.2-5-5.3-5.3-3.6-.3-11.4-.5-15-.5-7.3 0-10.6.2-14.1.5-3.3.3-4.8 1.8-5.4 4.9-.4 2.1-.6 4.1-.6 8.9 0 4.3.2 6.9.5 9.2.4 3.1 2.5 4.8 5.7 5.1 3.6.3 10.9.5 14.4.5s11.2-.2 14.7-.6c3.1-.4 4.6-2 5.1-5.1 0 0 .5-3.3.5-9.1 0-3.3-.2-6.4-.5-8.5zM19.7 29.8V18l11.2 5.8-11.2 6z"></path></svg>';
    str += '</a>';
    str += '</div>';

    //Instagram
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.instagram + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 25 25" enable-background="new 0 0 25 25" xml:space="preserve"><desc>Instagram</desc><path d="M16.396,3.312H8.604c-2.921,0-5.292,2.371-5.292,5.273v7.846c0,2.886,2.371,5.256,5.292,5.256h7.791c2.922,0,5.292-2.37,5.292-5.274V8.586C21.688,5.683,19.317,3.312,16.396,3.312L16.396,3.312z M7.722,12.5c0-2.64,2.142-4.778,4.778-4.778c2.636,0,4.777,2.138,4.777,4.778s-2.142,4.777-4.777,4.777C9.864,17.277,7.722,15.14,7.722,12.5zM17.756,8.182c-0.615,0-1.104-0.487-1.104-1.102s0.488-1.103,1.104-1.103c0.614,0,1.102,0.488,1.102,1.103S18.37,8.182,17.756,8.182L17.756,8.182z"></path><path d="M12.5,9.376c-1.731,0-3.124,1.398-3.124,3.124c0,1.725,1.393,3.124,3.124,3.124c1.732,0,3.124-1.399,3.124-3.124C15.624,10.775,14.211,9.376,12.5,9.376L12.5,9.376z"></path></svg>';
    str += '</a>';
    str += '</div>';

    //Telegram
    str += '<div class="tc-news__social-item">';
    str += '<a href="' + socialLinks.telegram + '" target="_blank" rel="noopener noreferrer">';
    str += '<svg class="tc-news__social-icon" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="25px" height="25px" viewBox="0 0 60 60" xml:space="preserve"><desc>Telegram</desc><path d="M52.5,9L6.1,26.9c-0.9,0.4-0.9,1.8,0,2.3l11.9,4.9l4.4,14.1c0.3,0.8,1.2,1,1.8,0.5l6.8-6.4l12.9,8.7c0.7,0.4,1.6,0,1.7-0.7L54,10.3C54.2,9.5,53.3,8.7,52.5,9z M24.5,36.7L23.8,44l-3.6-11.2l25.3-16.8L24.5,36.7z"></path></svg>';
    str += '</a>';
    str += '</div>';

    return str;
}

function t_news_drawPreloaders(amount, total) {
    var wrapper = $('.js-feed-preloader');
    wrapper.empty();

    var newAmount = amount;
    if (total) {
        newAmount = (total % amount) || amount;
    }

    var str = '';
    for (let i = 0; i < newAmount; i++) {
        str += '<div class="t-feed__post-preloader">';
        str += '<div class="t-feed__post-preloader__wrapper">';
        str += '<div class="t-feed__post-preloader__img"></div>';
        str += '<div class="t-feed__post-preloader__textwrapper">';
        str += '<div class="t-feed__post-preloader__text"></div>';
        str += '<div class="t-feed__post-preloader__text"></div>';
        str += '<div class="t-feed__post-preloader__text"></div>';
        str += '<div class="t-feed__post-preloader__text"></div>';
        str += '<div class="t-feed__post-preloader__text"></div>';
        str += '</div>';
        str += '</div>';
        str += '</div>';
    }
    wrapper.append(str);
}

function t_news_onWidgetClick() {
    var news = JSON.parse(localStorage.getItem('tNews'));
    var mockOpts = t_news_getMockOpts(tNewsWidget.postsPerSlice, 1);

    //  If there are no posts, load them
    if (tNewsWidget.loadingTimer) {
        clearTimeout(tNewsWidget.loadingTimer);
        tNewsWidget.loadingTimer = null;
        t_news_loadPosts(tNewsWidget.recid, mockOpts, 1);
    } else if (!news || !news['isEverLoaded']) {
        t_news_loadPosts(tNewsWidget.recid, mockOpts, 1);
    }

    var wrapper = $('#tc-news');
    var panel = wrapper.find('.tc-news__panel');
    panel.addClass('tc-news__panel_visible');
    t_news_setReadTime();
    t_news_drawUnreadCounter(0);
}

function t_news_closePanel() {
    var wrapper = $('#tc-news');
    var panel = wrapper.find('.tc-news__panel');
    panel.removeClass('tc-news__panel_visible');
}

function t_news_getLazyUrl(imgSrc) {
    if (window.lazy !== 'y') {
        return imgSrc;
    }

    if (imgSrc.indexOf('static.tildacdn.com') === -1) {
        /* we cant apply lazy load to images, hosted to another servers */
        return imgSrc;
    }
    var arr = imgSrc.split('/');
    arr.splice(imgSrc.split('/').length - 1, 0, '-/resizeb/x20');
    var newSrc = arr.join('/');
    return newSrc;
}

function t_news_checkUnreadPosts(posts) {
    var news = JSON.parse(localStorage.getItem('tNews'));

    if (news) {
        var readTime = news.readTime;

        setTimeout(function () {
            var unreadPosts = 0;

            for (var key in posts) {
                var item = posts[key];

                if (item.uid) {
                    var date = item.date ? t_news_parseDate(item.published) : null;

                    if (+date > +readTime) {
                        unreadPosts++;
                    }
                }
            }
            // If all loaded tickets are unread, don't show counter
            if (+posts.length === unreadPosts) {
                unreadPosts = 0;
            }

            news.unreadPosts = unreadPosts;
            localStorage.setItem('tNews', JSON.stringify(news));

            if (unreadPosts > 0) {
                t_news_drawUnreadCounter(unreadPosts);
            }
        }, 1000);
    }
}

function t_news_setReadTime() {
    var date = Date.now();
    let news = JSON.parse(localStorage.getItem('tNews'));

    if (!news) {
        news = {};
    }

    news['readTime'] = date;
    localStorage.setItem('tNews', JSON.stringify(news));
}

function t_news_getMockOpts(size, slice) {
    var lang = t_news_returnLang();
    var feeduid = lang === 'RU' ? tNewsWidget.feeduid : tNewsWidget['EN'].feeduid;
    var recid = lang === 'RU' ? tNewsWidget.recid : tNewsWidget['EN'].recid;

    var opts = {
        feeduid: feeduid,
        recid: recid,
        c: Date.now(),
        size: size,
        slice: slice,
        reverse: 'desc',
        getparts: false,
        dateFilter: 'all',
        isPublishedPage: true,
        previewmode: true
    }

    return opts;
}

function t_news_parseDate(string) {
    var dateTimeParts = string.split(' '),
        timeParts = dateTimeParts[1].split(':'),
        dateParts = dateTimeParts[0].split('-'),
        date;

    date = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2], timeParts[0], timeParts[1], timeParts[2]);
    return date.getTime();
}

function t_news_formatDate(string) {
    var dateTimeParts = string.split(' '),
        timeParts = dateTimeParts[1].split(':'),
        dateParts = dateTimeParts[0].split('-'),
        date;

    var year = dateParts[0];
    var month = parseInt(dateParts[1], 10);
    var day = dateParts[2];

    var months = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december'
    ];

    var lang = t_news_returnLang();
    var monthArr = t_news_getDictionary(months[month]);
    var monthTitle = monthArr[1];

    if (lang == 'EN' || lang == 'DE') {
        monthTitle = monthArr[0];
    }
    var separator = ' ';

    return day + separator + monthTitle + separator + year;
}


function t_news_getDictionary(msg) {
    var dict = [];

    dict['emptypartmsg'] = {
        EN: 'Nothing found',
        RU: 'Ничего не найдено',
        FR: 'Rien trouvé',
        DE: 'Nichts gefunden',
        ES: 'Nada encontrado',
        PT: 'Nada encontrado',
        UK: 'Нічого не знайдено',
        JA: '何も見つかりませんでした',
        ZH: '什么都没找到',
    };

    dict['title'] = {
        EN: 'Our News',
        RU: 'Наши новости',
        FR: 'Nos actualités',
        DE: 'Unsere Nachrichten',
        ES: 'Nuestras noticias',
        PT: 'Nasze aktualności',
        UK: 'Наші новини',
        JA: '私たちのニュース',
        ZH: '我们的新闻',
    };

    dict['all'] = {
        EN: 'All',
        RU: 'Все',
        FR: 'Tout',
        DE: 'Alles',
        ES: 'Todos',
        PT: 'Todos',
        UK: 'Всі',
        JA: 'すべて',
        ZH: '所有',
    };

    dict['external'] = {
        EN: 'Read more',
        RU: 'Подробнее',
        FR: "Lire la suite",
        DE: 'Weiterlesen',
        ES: 'Lee mas',
        PT: 'Czytaj więcej',
        UK: 'Детальніше',
        JA: '続きを読む',
        ZH: '阅读更多',
    };

    dict['showmore'] = {
        EN: 'Show More',
        RU: 'Показать еще',
        FR: 'Montre plus',
        DE: 'Zeig mehr',
        ES: 'Mostrar más',
        PT: 'Pokaż więcej',
        UK: 'Показати ще',
        JA: 'もっと見せる',
        ZH: '显示更多',
    };

    dict['expand'] = {
        EN: 'Expand',
        RU: 'Развернуть',
        FR: 'Développer',
        DE: 'Erweitern',
        ES: 'Expandir',
        PT: 'Rozszerzać',
        UK: 'Розгорнути',
        JA: '拡大する',
        ZH: '扩大',
    };

    dict['seealso'] = {
        EN: 'See also',
        RU: 'Смотрите также',
        FR: 'Voir également',
        DE: 'Siehe auch',
        ES: 'Ver también',
        PT: 'Veja também',
        UK: 'Дивись також',
        JA: 'また見なさい',
        ZH: '也可以看看',
    };

    dict['today'] = {
        EN: 'Today',
        RU: 'Сегодня',
        FR: 'Aujourd\'hui',
        DE: 'Heute',
        ES: 'Hoy',
        PT: 'Hoje',
        UK: 'Сьогодні',
        JA: '今日',
        ZH: '今天',
    };

    dict['yesterday'] = {
        EN: 'Yesterday',
        RU: 'Вчера',
        FR: 'Hier',
        DE: 'Gestern',
        ES: 'Ayer',
        PT: 'Ontem',
        UK: 'Вчора',
        JA: '昨日',
        ZH: '昨天',
    };

    dict['days'] = {
        EN: ['days'],
        RU: ['дня', 'дней'],
        FR: ['jours'],
        DE: ['tagen'],
        ES: ['dias'],
        PT: ['dias'],
        UK: ['дні', 'днів'],
        JA: ['日'],
        ZH: ['天'],
    };

    dict['ago'] = {
        EN: 'ago',
        RU: 'назад',
        FR: 'Il y a',
        DE: 'Vor',
        ES: 'Hace',
        PT: 'Há',
        UK: 'тому',
        JA: '前',
        ZH: '前',
    };

    dict['january'] = {
        EN: ['January', 'january'],
        RU: ['Январь', 'января'],
        FR: ['Janvier', 'janvier'],
        DE: ['Januar', 'januar'],
        ES: ['Enero', 'de enero'],
        PT: ['Janeiro', 'de janeiro'],
        UK: ['Січень', 'січня'],
        JA: ['一月', '一月'],
        ZH: ['一月', '一月'],
    };

    dict['february'] = {
        EN: ['February', 'february'],
        RU: ['Февраль', 'февраля'],
        FR: ['Février', 'février'],
        DE: ['Februar', 'februar'],
        ES: ['Febrero', 'de febrero'],
        PT: ['Fevereiro', 'de fevereiro'],
        UK: ['Лютий', 'лютого'],
        JA: ['二月', '二月'],
        ZH: ['二月', '二月'],
    };

    dict['march'] = {
        EN: ['March', 'March'],
        RU: ['Март', 'марта'],
        FR: ['Mars', 'mars'],
        DE: ['März', 'märz'],
        ES: ['Marzo', 'de marzo'],
        PT: ['Março', 'de março'],
        UK: ['Березень', 'березня'],
        JA: ['三月', '三月'],
        ZH: ['三月', '三月'],
    };

    dict['april'] = {
        EN: ['April', 'april'],
        RU: ['Апрель', 'апреля'],
        FR: ['Avril', 'avril'],
        DE: ['April', 'april'],
        ES: ['Abril', 'de abril'],
        PT: ['Abril', 'de abril'],
        UK: ['Квітень', 'квітня'],
        JA: ['四月', '四月'],
        ZH: ['四月', '四月'],
    };

    dict['may'] = {
        EN: ['May', 'may'],
        RU: ['Май', 'мая'],
        FR: ['Mai', 'mai'],
        DE: ['Kann', 'kann'],
        ES: ['Mayo', 'de mayo'],
        PT: ['Maio', 'de maio'],
        UK: ['Травень', 'травня'],
        JA: ['五月', '五月'],
        ZH: ['五月', '五月'],
    };

    dict['june'] = {
        EN: ['June', 'june'],
        RU: ['Июнь', 'июня'],
        FR: ['Juin', 'juin'],
        DE: ['Juni', 'juni'],
        ES: ['Junio', 'de junio'],
        PT: ['Junho', 'de junho'],
        UK: ['Червень', 'червня'],
        JA: ['六月', '六月'],
        ZH: ['六月', '六月'],
    };

    dict['july'] = {
        EN: ['July', 'july'],
        RU: ['Июль', 'июля'],
        FR: ['Juillet', 'juillet'],
        DE: ['Juli', 'Juli'],
        ES: ['Julio', 'de julio'],
        PT: ['Julho', 'de julho'],
        UK: ['Липень', 'липня'],
        JA: ['七月', '七月'],
        ZH: ['七月', '七月'],
    };

    dict['august'] = {
        EN: ['August', 'august'],
        RU: ['Август', 'августа'],
        FR: ['Août', 'août'],
        DE: ['August', 'august'],
        ES: ['Agosto', 'de agosto'],
        PT: ['Agosto', 'de agosto'],
        UK: ['Серпень', 'серпня'],
        JA: ['八月', '八月'],
        ZH: ['八月', '八月'],
    };

    dict['september'] = {
        EN: ['September', 'september'],
        RU: ['Сентябрь', 'сентября'],
        FR: ['Septembre', 'septembre'],
        DE: ['September', 'september'],
        ES: ['Septiembre', 'de septiembre'],
        PT: ['Setembro', 'de setembro'],
        UK: ['Вересень', 'вересня'],
        JA: ['九月', '九月'],
        ZH: ['九月', '九月'],
    };

    dict['october'] = {
        EN: ['October', 'october'],
        RU: ['Октябрь', 'октября'],
        FR: ['Octobre', 'octobre'],
        DE: ['Oktober', 'oktober'],
        ES: ['Octubre', 'de octubre'],
        PT: ['Outubro', 'de outubro'],
        UK: ['Жовтень', 'жовтня'],
        JA: ['十月', '十月'],
        ZH: ['十月', '十月'],
    };

    dict['november'] = {
        EN: ['November', 'november'],
        RU: ['Ноябрь', 'ноября'],
        FR: ['Novembre', 'novembre'],
        DE: ['November', 'november'],
        ES: ['Noviembre', 'de noviembre'],
        PT: ['Novembro', 'de novembro'],
        UK: ['Листопад', 'листопада'],
        JA: ['十一月', '十一月'],
        ZH: ['十一月', '十一月'],
    };

    dict['december'] = {
        EN: ['December', 'december'],
        RU: ['Декабрь', 'декабря'],
        FR: ['Décembre', 'décembre'],
        DE: ['Dezember', 'dezember'],
        ES: ['Diciembre', 'de diciembre'],
        PT: ['Dezembro', 'de dezembro'],
        UK: ['Грудень', 'грудня'],
        JA: ['十二月', '十二月'],
        ZH: ['十二月', '十二月'],
    };

    var lang = t_news_returnLang();

    if (typeof dict[msg] !== 'undefined') {
        if (typeof dict[msg][lang] !== 'undefined' && dict[msg][lang] != '') {
            return dict[msg][lang];
        } else {
            return dict[msg]['EN'];
        }
    }

    return 'Text not found "' + msg + '"';
}

function t_news_returnLang() {
    t_news_defineUserLang();

    var lang = window.tildaBrowserLang || 'EN';
    return lang;
}

function t_news_defineUserLang() {
    window.tildaBrowserLang = window.navigator.userLanguage || window.navigator.language;
    window.tildaBrowserLang = window.tildaBrowserLang.toUpperCase();

    if (window.tildaBrowserLang.indexOf('RU') != -1) {
        window.tildaBrowserLang = 'RU';
    } else if (window.tildaBrowserLang.indexOf('FR') != -1) {
        window.tildaBrowserLang = 'FR';
    } else if (window.tildaBrowserLang.indexOf('DE') != -1) {
        window.tildaBrowserLang = 'DE';
    } else if (window.tildaBrowserLang.indexOf('ES') != -1) {
        window.tildaBrowserLang = 'ES';
    } else if (window.tildaBrowserLang.indexOf('PT') != -1) {
        window.tildaBrowserLang = 'PT';
    } else if (window.tildaBrowserLang.indexOf('UK') != -1) {
        window.tildaBrowserLang = 'UK';
    } else if (window.tildaBrowserLang.indexOf('JA') != -1) {
        window.tildaBrowserLang = 'JA';
    } else if (window.tildaBrowserLang.indexOf('ZH') != -1) {
        window.tildaBrowserLang = 'ZH';
    } else {
        window.tildaBrowserLang = 'EN';
    }
}

$(document).ready(function () {
    t_news_init();
});