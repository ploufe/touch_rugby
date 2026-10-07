(() => {
    const posts = document.querySelector("#posts");
    const lessonList = document.querySelector("#lesson-list");
    const search = document.querySelector("#search");
    const emptyState = document.querySelector("#empty-state");
    const lessonCount = document.querySelector("#lesson-count");
    const pageLayout = document.querySelector(".page-layout");
    const sidebar = document.querySelector("#lesson-sidebar");
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const searchState = { query: "" };
    const savedLessons = new Set();
    let activeTab = "basics";
    let videoObserver;

    if (!Array.isArray(window.LESSONS) || window.LESSONS.length === 0) {
        console.error("Le catalogue des leçons est vide. Exécutez build_lessons.ps1.");
        emptyState.hidden = false;
        emptyState.textContent = "Les leçons n’ont pas pu être chargées. Vérifie le catalogue du site.";
        return;
    }

    const lessons = [...window.LESSONS].sort((a, b) => a.number - b.number);
    const padNumber = (number) => String(number).padStart(2, "0");

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function formatDate(value) {
        if (!value) return "";
        const parsed = new Date(`${value}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) return "";
        return new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(parsed);
    }

    function playVisibleVideos() {
        if (activeTab !== "lessons" || document.hidden) return;
        for (const video of posts.querySelectorAll("video")) {
            const rect = video.getBoundingClientRect();
            const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
            const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
            if (visibleHeight <= 0 || visibleWidth <= 0) continue;
            video.play().catch((error) => {
                if (error.name !== "AbortError") {
                    console.warn("La lecture automatique de cette vidéo a été bloquée par le navigateur.", error);
                }
            });
        }
    }

    function setActiveTab(name, moveFocus = false) {
        activeTab = name;
        const isBasics = name === "basics";
        for (const tab of tabs) {
            const selected = tab.id === `tab-${name}`;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
            document.querySelector(`#${tab.getAttribute("aria-controls")}`).hidden = !selected;
            if (selected && moveFocus) tab.focus();
        }
        sidebar.hidden = isBasics;
        pageLayout.classList.toggle("is-basics", isBasics);
        if (isBasics) {
            for (const video of posts.querySelectorAll("video")) video.pause();
        } else {
            playVisibleVideos();
        }
    }

    function scrollToLesson(number) {
        if (searchState.query) {
            searchState.query = "";
            search.value = "";
            renderPosts();
        }
        setActiveTab("lessons");
        requestAnimationFrame(() => {
            document.querySelector(`#lesson-${number}`)?.scrollIntoView({ behavior: "smooth" });
        });
    }

    function renderNavigation() {
        lessonCount.textContent = String(lessons.length);

        for (const lesson of lessons) {
            const item = document.createElement("li");
            const link = createElement("a", "lesson-link");
            link.href = `#lesson-${lesson.number}`;
            const number = createElement("span", "lesson-number", padNumber(lesson.number));
            const title = createElement("span", "lesson-link-title", lesson.title);
            link.append(number, title);
            link.addEventListener("click", (event) => {
                event.preventDefault();
                scrollToLesson(lesson.number);
            });
            item.append(link);
            lessonList.append(item);
        }
    }

    function observeVideo(video) {
        if (videoObserver) {
            videoObserver.observe(video);
        } else {
            playVisibleVideos();
        }
    }

    function renderMedia(lesson, mediaItems) {
        const carousel = createElement("div", "carousel");
        carousel.setAttribute("role", "group");
        carousel.setAttribute("aria-label", `Médias de la leçon ${lesson.number}`);

        if (mediaItems.length === 0) {
            const fallback = createElement("div", "carousel-empty");
            fallback.append(
                createElement("span", "", "🏉"),
                createElement("strong", "", `Leçon ${lesson.number}`),
            );
            carousel.append(fallback);
            return carousel;
        }

        let activeIndex = 0;
        const media = createElement("div", "carousel-media");
        const count = createElement("span", "slide-count");
        count.setAttribute("aria-live", "polite");
        const previous = createElement("button", "carousel-arrow prev", "‹");
        previous.type = "button";
        previous.setAttribute("aria-label", "Média précédent");
        previous.hidden = mediaItems.length < 2;
        const next = createElement("button", "carousel-arrow next", "›");
        next.type = "button";
        next.setAttribute("aria-label", "Média suivant");
        next.hidden = mediaItems.length < 2;
        const dots = createElement("div", "carousel-dots");
        dots.setAttribute("aria-label", "Choisir un média");

        function showMedia(index) {
            activeIndex = (index + mediaItems.length) % mediaItems.length;
            const item = mediaItems[activeIndex];
            const currentVideo = media.querySelector("video");
            if (currentVideo) {
                currentVideo.pause();
                videoObserver?.unobserve(currentVideo);
            }
            media.replaceChildren();
            if (item.type === "video") {
                const video = document.createElement("video");
                video.controls = true;
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                video.preload = "metadata";
                video.src = item.src;
                if (item.poster) video.poster = item.poster;
                video.setAttribute("aria-label", `Vidéo ${activeIndex + 1} de la leçon ${lesson.number}`);
                media.append(video);
                observeVideo(video);
            } else {
                const image = document.createElement("img");
                image.src = item.src;
                image.alt = `Leçon ${lesson.number}, diapositive ${activeIndex + 1}`;
                image.loading = activeIndex === 0 ? "eager" : "lazy";
                media.append(image);
            }
            count.textContent = `${activeIndex + 1} / ${mediaItems.length}`;
            for (const [dotIndex, dot] of [...dots.children].entries()) {
                dot.setAttribute("aria-current", String(dotIndex === activeIndex));
            }
        }

        mediaItems.forEach((_, index) => {
            const dot = createElement("button", "carousel-dot");
            dot.type = "button";
            dot.setAttribute("aria-label", `Afficher le média ${index + 1}`);
            dot.addEventListener("click", () => showMedia(index));
            dots.append(dot);
        });
        previous.addEventListener("click", () => showMedia(activeIndex - 1));
        next.addEventListener("click", () => showMedia(activeIndex + 1));
        carousel.append(media, count, previous, next, dots);
        showMedia(0);
        return carousel;
    }

    function createPost(lesson) {
        const post = createElement("article", "post-card");
        post.id = `lesson-${lesson.number}`;

        const header = createElement("header", "post-header");
        const profile = createElement("div", "post-profile");
        profile.append(createElement("span", "profile-avatar", "↗"));
        const profileText = document.createElement("div");
        profileText.append(
            createElement("p", "profile-name", "Touch Rugby Classroom"),
            createElement("p", "post-date", formatDate(lesson.publishedAt) || `Leçon ${lesson.number}`),
        );
        profile.append(profileText);
        header.append(
            profile,
            createElement("span", "post-lesson-tag", lesson.category),
        );

        const media = renderMedia(lesson, lesson.media);
        const actions = createElement("div", "post-actions");
        const imageCount = lesson.media.filter((item) => item.type === "image").length;
        const videoCount = lesson.media.filter((item) => item.type === "video").length;
        const mediaSummary = [
            imageCount ? `${imageCount} image${imageCount === 1 ? "" : "s"}` : "",
            videoCount ? `${videoCount} vidéo${videoCount === 1 ? "" : "s"}` : "",
        ].filter(Boolean).join(" · ");
        actions.append(createElement("span", "media-indicator", mediaSummary));

        const save = createElement("button", "save-button");
        save.type = "button";
        save.setAttribute("aria-pressed", String(savedLessons.has(lesson.number)));
        const saveIcon = createElement("span", "save-icon", savedLessons.has(lesson.number) ? "★" : "☆");
        saveIcon.setAttribute("aria-hidden", "true");
        const saveLabel = createElement("span", "", savedLessons.has(lesson.number) ? "À revoir" : "Garder en tête");
        save.append(saveIcon, saveLabel);
        save.addEventListener("click", () => {
            if (savedLessons.has(lesson.number)) {
                savedLessons.delete(lesson.number);
            } else {
                savedLessons.add(lesson.number);
            }
            const isSaved = savedLessons.has(lesson.number);
            save.setAttribute("aria-pressed", String(isSaved));
            saveIcon.textContent = isSaved ? "★" : "☆";
            saveLabel.textContent = isSaved ? "À revoir" : "Garder en tête";
        });
        actions.append(save);

        const caption = createElement("div", "post-caption");
        caption.append(createElement("h3", "", `Leçon ${padNumber(lesson.number)} · ${lesson.title}`));
        const captionCopy = createElement("p", "caption-copy is-collapsed", lesson.caption);
        caption.append(captionCopy);
        if (lesson.caption.length > 220) {
            const expand = createElement("button", "expand-button", "Lire la suite");
            expand.type = "button";
            expand.setAttribute("aria-expanded", "false");
            expand.addEventListener("click", () => {
                const isExpanded = expand.getAttribute("aria-expanded") === "true";
                expand.setAttribute("aria-expanded", String(!isExpanded));
                captionCopy.classList.toggle("is-collapsed", isExpanded);
                expand.textContent = isExpanded ? "Lire la suite" : "Réduire";
            });
            caption.append(expand);
        }
        if (lesson.hashtags.length) {
            const hashtagList = createElement("div", "post-hashtags");
            for (const tag of lesson.hashtags) {
                hashtagList.append(createElement("span", "hashtag", tag));
            }
            caption.append(hashtagList);
        }
        post.append(header, caption, media, actions);
        return post;
    }

    function renderPosts() {
        const query = searchState.query.trim().toLocaleLowerCase("fr");
        const visibleLessons = lessons.filter((lesson) => {
            const searchableText = `${lesson.title} ${lesson.caption} ${lesson.hashtags.join(" ")}`.toLocaleLowerCase("fr");
            return !query || searchableText.includes(query);
        });

        posts.replaceChildren(...visibleLessons.map(createPost));
        emptyState.hidden = visibleLessons.length > 0;
    }

    videoObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const video = entry.target;
                if (entry.isIntersecting && activeTab === "lessons" && !document.hidden) {
                    video.play().catch((error) => {
                        if (error.name !== "AbortError") {
                            console.warn("La lecture automatique de cette vidéo a été bloquée par le navigateur.", error);
                        }
                    });
                } else {
                    video.pause();
                }
            }
        }, { threshold: 0.35 })
        : null;

    for (const [index, tab] of tabs.entries()) {
        tab.addEventListener("click", () => setActiveTab(tab.id.replace("tab-", "")));
        tab.addEventListener("keydown", (event) => {
            let nextIndex;
            if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
            if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = tabs.length - 1;
            if (nextIndex !== undefined) {
                event.preventDefault();
                setActiveTab(tabs[nextIndex].id.replace("tab-", ""), true);
            }
        });
    }

    search.addEventListener("input", () => {
        searchState.query = search.value;
        renderPosts();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            for (const video of posts.querySelectorAll("video")) video.pause();
        } else {
            playVisibleVideos();
        }
    });

    renderNavigation();
    renderPosts();
    setActiveTab("basics");
})();
