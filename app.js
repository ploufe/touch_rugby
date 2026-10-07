(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const pageLayout = document.querySelector(".page-layout");
    const sidebar = document.querySelector("#video-sidebar");
    const lessonList = document.querySelector("#video-lesson-list");
    const videoLessonsContainer = document.querySelector("#video-lessons");
    const videoCount = document.querySelector("#video-count");
    const search = document.querySelector("#search");
    const emptyState = document.querySelector("#empty-state");
    const searchState = { query: "" };
    let activeTab = "basics";
    let videoObserver;

    if (!Array.isArray(window.LESSONS) || window.LESSONS.length === 0) {
        console.error("Le catalogue des leçons est vide. Exécutez build_lessons.ps1.");
        emptyState.hidden = false;
        emptyState.textContent = "Les leçons n’ont pas pu être chargées. Vérifie le catalogue du site.";
        return;
    }

    const lessons = [...window.LESSONS].sort((a, b) => a.number - b.number);
    const videoLessons = lessons.filter((lesson) => lesson.media.some((item) => item.type === "video"));
    const videoTotal = videoLessons.reduce(
        (total, lesson) => total + lesson.media.filter((item) => item.type === "video").length,
        0,
    );

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

    function setActiveTab(name, moveFocus = false) {
        activeTab = name;
        const isVideos = name === "videos";
        for (const tab of tabs) {
            const selected = tab.id === `tab-${name}`;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
            document.querySelector(`#${tab.getAttribute("aria-controls")}`).hidden = !selected;
            if (selected && moveFocus) tab.focus();
        }
        sidebar.hidden = !isVideos;
        pageLayout.classList.toggle("is-basics", !isVideos);
        if (!isVideos) {
            for (const video of videoLessonsContainer.querySelectorAll("video")) video.pause();
        }
    }

    function scrollToLesson(number) {
        if (searchState.query) {
            searchState.query = "";
            search.value = "";
            renderVideoLessons();
        }
        setActiveTab("videos");
        requestAnimationFrame(() => {
            document.querySelector(`#video-lesson-${number}`)?.scrollIntoView({ behavior: "smooth" });
        });
    }

    function renderNavigation() {
        videoCount.textContent = String(videoTotal);

        for (const lesson of videoLessons) {
            const item = document.createElement("li");
            const link = createElement("a", "lesson-link");
            link.href = `#video-lesson-${lesson.number}`;
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
        } else if (activeTab === "videos") {
            video.play().catch((error) => {
                if (error.name !== "AbortError") {
                    console.warn("La lecture automatique de cette vidéo a été bloquée par le navigateur.", error);
                }
            });
        }
    }

    function createVideo(lesson, item, index) {
        const video = document.createElement("video");
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = "none";
        video.src = item.src;
        if (item.poster) video.poster = item.poster;
        video.setAttribute("aria-label", `Vidéo ${index + 1} de la leçon ${lesson.number}`);
        observeVideo(video);
        return video;
    }

    function createVideoLesson(lesson) {
        const article = createElement("article", "video-lesson-card");
        article.id = `video-lesson-${lesson.number}`;

        const header = createElement("header", "video-lesson-header");
        const heading = createElement("h2", "", `Leçon ${padNumber(lesson.number)} · ${lesson.title}`);
        const videoItems = lesson.media.filter((item) => item.type === "video");
        header.append(
            heading,
            createElement("span", "post-lesson-tag", `${videoItems.length} vidéo${videoItems.length === 1 ? "" : "s"}`),
        );

        const summary = createElement("p", "video-lesson-summary", lesson.caption);
        const grid = createElement("div", "video-grid");
        for (const [index, item] of videoItems.entries()) {
            const figure = createElement("figure", "video-item");
            figure.append(
                createVideo(lesson, item, index),
                createElement("figcaption", "", `Leçon ${padNumber(lesson.number)} · Vidéo ${index + 1}`),
            );
            grid.append(figure);
        }

        article.append(header, summary, grid);
        return article;
    }

    function renderVideoLessons() {
        const query = searchState.query.trim().toLocaleLowerCase("fr");
        const visibleLessons = videoLessons.filter((lesson) => {
            const searchableText = `${lesson.title} ${lesson.caption} ${lesson.hashtags.join(" ")}`.toLocaleLowerCase("fr");
            return !query || searchableText.includes(query);
        });

        videoLessonsContainer.replaceChildren(...visibleLessons.map(createVideoLesson));
        emptyState.hidden = visibleLessons.length > 0;
        for (const item of lessonList.children) {
            const number = Number(item.querySelector("a").hash.replace("#video-lesson-", ""));
            item.hidden = !visibleLessons.some((lesson) => lesson.number === number);
        }
    }

    videoObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const video = entry.target;
                if (entry.isIntersecting && activeTab === "videos" && !document.hidden) {
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
        renderVideoLessons();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            for (const video of videoLessonsContainer.querySelectorAll("video")) video.pause();
        }
    });

    renderNavigation();
    renderVideoLessons();
    setActiveTab("basics");
})();
