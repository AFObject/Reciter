// === 全局变量 ===
let currentArticleData = null;
let currentFilename = ""; // 记录当前打开的文件名，用于保存

// === 1. 初始化与加载 ===
window.onload = async function () {
    await loadCatalog();
    // 默认加载第一篇
    const select = document.getElementById('presetSelect');
    if (select.options.length > 1) {
        select.selectedIndex = 1;
        loadPreset();
    }
};

async function loadCatalog() {
    try {
        const response = await fetch('data/catalog.json');
        const list = await response.json();
        const select = document.getElementById('presetSelect');
        select.innerHTML = '<option value="" disabled selected>-- 选择篇目 --</option>';
        list.forEach(item => {
            const option = document.createElement('option');
            option.value = item.filename; // value 存文件名
            option.textContent = item.title;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("加载目录失败，请确保 server.py 已运行", e);
        alert("连接服务器失败，请运行 python server.py");
    }
}

async function loadPreset() {
    const filename = document.getElementById('presetSelect').value;
    if (!filename) return;

    currentFilename = filename;
    try {
        const response = await fetch(`data/${filename}`);
        const data = await response.json();

        // 数据校验与补全：如果 mask 不存在或长度不对，自动修正
        const len = data.content.length;
        if (!data.colorMask || data.colorMask.length !== len) {
            data.colorMask = '0'.repeat(len);
        }
        if (!data.styleMask || data.styleMask.length !== len) {
            data.styleMask = '0'.repeat(len);
        }

        currentArticleData = data;

        // 填充界面
        document.getElementById('customTitle').value = data.title;
        document.getElementById('customInput').value = data.content;

        // 渲染
        applyTextAndReset();
    } catch (e) {
        console.error("加载文章失败", e);
    }
}

// === 2. 渲染核心 (修复标点错位 Bug) ===
function applyTextAndReset() {
    // 每次渲染前，都重新读取一遍 Input 里的文本
    // 为什么？因为你可能在输入框里修改了错别字，这时候 mask 会错位
    // 但为了背诵体验，我们暂时假设用户不改原文。
    updateView();
}

function updateView() {
    const text = document.getElementById('customInput').value;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    const randomConfig = document.getElementById('randomConfig');
    const qaControls = document.getElementById('qaControls');
    const normalOutput = document.getElementById('output');
    const qaOutput = document.getElementById('qaOutput');

    // UI 元素显隐控制
    randomConfig.style.display = (mode === 'random') ? 'block' : 'none';
    qaControls.style.display = (mode === 'qa') ? 'block' : 'none';

    if (mode === 'qa') {
        normalOutput.style.display = 'none';
        qaOutput.style.display = 'flex';
        generateAndRenderQuestion(text);
    } else {
        normalOutput.style.display = 'block';
        qaOutput.style.display = 'none';
        renderNormalMode(text, mode);
    }
}

function renderNormalMode(text, mode) {
    const outputDiv = document.getElementById('output');

    // 渲染标题
    let html = '';
    const titleVal = document.getElementById('customTitle').value;
    if (titleVal) html += `<div class="article-title">${titleVal}</div>`;

    // 核心渲染循环：按标点分割，但严格追踪 Index
    // 正则：分割中文和非中文
    const parts = text.split(/([^\u4e00-\u9fa5]+)/g);

    let globalIndex = 0; // 这是一个绝对指针，指向 currentArticleData.content 的下标

    parts.forEach(part => {
        if (!part) return;

        // 判断这一段是 中文 还是 标点/符号
        const isPunc = /[^\u4e00-\u9fa5]/.test(part);

        // 无论中文还是标点，我们都逐字处理，以保证 Mask 准确
        let segmentHtml = '';
        for (let i = 0; i < part.length; i++) {
            const char = part[i];
            const absIndex = globalIndex; // 当前字符在原文中的绝对位置

            // 1. 获取 Mask 样式
            let extraClasses = '';
            // 防止越界
            if (currentArticleData && absIndex < currentArticleData.colorMask.length) {
                const c = currentArticleData.colorMask[absIndex];
                const s = currentArticleData.styleMask[absIndex];
                if (c !== '0') extraClasses += ` c-${c}`;
                if (s !== '0') extraClasses += ` s-${s}`;
            }

            // 2. 生成 HTML
            const safeChar = char.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            if (isPunc) {
                // 标点：不挖空，但应用样式
                // 换行符特殊处理
                if (char === '\n') {
                    segmentHtml += '<br>';
                } else {
                    segmentHtml += `<span class="punctuation${extraClasses}" data-index="${absIndex}">${safeChar}</span>`;
                }
            } else {
                // 中文：应用挖空逻辑
                let shouldMask = true;
                // 这里把 segment logic 简化内联，确保 index 正确
                const ratio = document.getElementById('randomRatio').value / 100;

                // 为了实现“首字提示”，我们需要知道当前字是这句话(part)的第几个字
                const localIndex = i;
                const partLen = part.length;

                switch (mode) {
                    case 'all': shouldMask = true; break;
                    case 'show': shouldMask = false; break;
                    case 'head1': if (localIndex === 0) shouldMask = false; break;
                    case 'head2': if (localIndex < 2) shouldMask = false; break;
                    case 'headTail': if (localIndex === 0 || localIndex === partLen - 1) shouldMask = false; break;
                    case 'random': if (Math.random() < ratio) shouldMask = false; break;
                }

                if (shouldMask) {
                    segmentHtml += `<span class="char masked${extraClasses}" data-index="${absIndex}" data-answer="${char}">${char}</span>`;
                } else {
                    segmentHtml += `<span class="char${extraClasses}" data-index="${absIndex}">${char}</span>`;
                }
            }

            globalIndex++; // 指针后移
        }

        html += segmentHtml;
    });

    outputDiv.innerHTML = html;
}

function updateRatioDisplay() {
    const val = document.getElementById('randomRatio').value;
    document.getElementById('ratioDisplay').textContent = val + "%";
}

function updateStyle() {
    const style = document.getElementById('styleSelect').value;
    const output = document.getElementById('output');
    // 移除所有style-开头的类
    output.classList.forEach(cls => {
        if (cls.startsWith('style-')) output.classList.remove(cls);
    });
    output.classList.add(style);
}
function updateFontSize() {
    const val = document.getElementById('fontSizeSlider').value;
    document.getElementById('fontSizeDisplay').textContent = val + "px";
    document.documentElement.style.setProperty('--reading-size', val + "px");
}