function checkEditMode() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const a = document.body.classList.contains('hide-marks');
    return (mode === 'show' && !a);
}

document.addEventListener('mouseup', function(e) {
    if (!checkEditMode()) return;
    const popup = document.getElementById('selectionPopup');
    const selection = window.getSelection();
    
    // 1. 如果点击的是 Popup 内部，不处理（防止点击按钮时 Popup 消失）
    if (popup.contains(e.target)) return;

    // 2. 如果没有选区，隐藏 Popup
    if (selection.isCollapsed) {
        popup.style.display = 'none';
        return;
    }

    // 3. 检查选区是否在文章内容区域内 (防止选中侧边栏也弹出)
    const outputDiv = document.getElementById('output'); // 确保你的渲染容器 ID 是 output
    if (!outputDiv.contains(selection.anchorNode)) {
        popup.style.display = 'none';
        return;
    }

    // 4. 计算位置并显示
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    popup.style.display = 'block';
    // 居中显示在选区上方
    popup.style.top = (rect.top + window.scrollY) + 'px'; 
    popup.style.left = (rect.left + window.scrollX + rect.width / 2 - popup.offsetWidth / 2) + 'px';
});

// === 核心：应用标记并自动保存 ===
window.applyMark = async function(type, val) {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    // 获取起止索引
    // 注意：这里的逻辑依赖于你的 span 有 data-index 属性
    // 如果选区跨越了多个节点，anchorNode 和 focusNode 可能指向 textNode，需要取 parentElement
    const getIndex = (node) => {
        let el = node.nodeType === 3 ? node.parentElement : node;
        return parseInt(el.getAttribute('data-index') || '-1');
    };

    let start = getIndex(selection.anchorNode);
    let end = getIndex(selection.focusNode);

    // 容错：防止选中了无效区域
    if (start === -1 || end === -1) return;
    if (start > end) [start, end] = [end, start];
    
    // 包含结束字符 (Selection 也就是光标位置，通常在字符后面，所以 end 需要包含)
    // 但这里如果是 textNode offset，逻辑较复杂。
    // 简化方案：我们假设用户选中的是 "字" 的集合。
    // 实际上，Range 对象包含了具体的 startOffset 和 endOffset。
    // 最稳健的做法是遍历 Range 内的所有 span。
    
    // === 稳健的遍历方案 ===
    const range = selection.getRangeAt(0);
    const spans = document.querySelectorAll('#output span[data-index]');
    let minIdx = Infinity, maxIdx = -Infinity;
    
    spans.forEach(span => {
        if (range.intersectsNode(span)) {
            const idx = parseInt(span.getAttribute('data-index'));
            if (idx < minIdx) minIdx = idx;
            if (idx > maxIdx) maxIdx = idx;
        }
    });
    
    if (minIdx === Infinity) return;

    // 修改内存数据 (调用你已有的 updateMaskData)
    // 假设你有名为 updateMaskData 的函数
    updateMaskData(minIdx, maxIdx, type, val);

    // 隐藏菜单 & 清除选区
    document.getElementById('selectionPopup').style.display = 'none';
    selection.removeAllRanges();

    // 立即重绘视图
    // 假设你有名为 updateView 或 applyTextAndReset 的函数
    updateView(); 

    // === 自动保存 (Auto Save) ===
    // 调用你已有的 saveToServer 函数
    await saveToServer(); 
    
    // 可选：给个轻微的反馈，比如 Popup 变绿一下，或者右下角 toast
    // console.log("Auto saved!");
};

// === 3. 编辑与保存 (真实保存) ===

// 划词 Popup 逻辑 (基本不变，只需确保 updateMaskData 修改的是 currentArticleData)
// ... (保留你之前的 popup 监听代码) ...

// 修改 updateMaskData 函数，确保 mask 字符串长度不够时自动补全
function updateMaskData(start, end, type, val) {
    if (!currentArticleData) return;

    // 确保 Mask 长度足够
    const ensureLen = (maskStr, targetLen) => {
        if (!maskStr) return '0'.repeat(targetLen);
        if (maskStr.length < targetLen) return maskStr + '0'.repeat(targetLen - maskStr.length);
        return maskStr;
    };

    const contentLen = currentArticleData.content.length;
    currentArticleData.colorMask = ensureLen(currentArticleData.colorMask, contentLen);
    currentArticleData.styleMask = ensureLen(currentArticleData.styleMask, contentLen);

    // 辅助：字符串替换
    const replaceRange = (str, s, e, char) => {
        const arr = str.split('');
        for (let i = s; i <= e; i++) {
            if (i < arr.length) arr[i] = char;
        }
        return arr.join('');
    };

    if (type === 'clean') {
        currentArticleData.colorMask = replaceRange(currentArticleData.colorMask, start, end, '0');
        currentArticleData.styleMask = replaceRange(currentArticleData.styleMask, start, end, '0');
    } else if (type === 'c') {
        currentArticleData.colorMask = replaceRange(currentArticleData.colorMask, start, end, val);
    } else if (type === 's') {
        currentArticleData.styleMask = replaceRange(currentArticleData.styleMask, start, end, val);
    }
}

// 【新增】真实保存到硬盘
async function saveToServer() {
    if (!currentArticleData || !currentFilename) return;

    // === 1. 数据清洗与格式化 (Format Data) ===
    const contentLen = currentArticleData.content.length;
    
    // 辅助函数：调整 Mask 长度
    const adjustMask = (mask) => {
        if (!mask) return '0'.repeat(contentLen);
        if (mask.length < contentLen) {
            // 短了：补 0
            return mask + '0'.repeat(contentLen - mask.length);
        } else if (mask.length > contentLen) {
            // 长了：截断
            return mask.substring(0, contentLen);
        }
        return mask;
    };

    currentArticleData.colorMask = adjustMask(currentArticleData.colorMask);
    currentArticleData.styleMask = adjustMask(currentArticleData.styleMask);

    // === 2. 发送请求 ===
    try {
        const response = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFilename,
                content: currentArticleData
            })
        });
        // ... (后续处理) ...
    } catch (e) {
        console.error("Auto save failed", e);
    }
}

document.addEventListener('keydown', function(e) {
    if (!checkEditMode()) return;
    // 只有在选区存在时才触发
    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    // 忽略输入框内的操作
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch(e.key.toLowerCase()) {
        case 'r': applyMark('c', 'r'); e.preventDefault(); break; // R -> Red
        case 'g': applyMark('c', 'g'); e.preventDefault(); break; // G -> Green
        case 'b': applyMark('c', 'b'); e.preventDefault(); break; // B -> Blue
        case 'u': applyMark('s', 'u'); e.preventDefault(); break; // U -> Underline
        case 'h': applyMark('s', 'h'); e.preventDefault(); break; // H -> Highlight
        case 'w': applyMark('s', 'w'); e.preventDefault(); break; // W -> Wavy
        case 'delete': 
        case 'backspace': applyMark('clean'); e.preventDefault(); break; // Del -> Clear
    }
});