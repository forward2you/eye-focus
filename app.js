(() => {
  "use strict";

  const svgNamespace = "http://www.w3.org/2000/svg";
  const display = document.querySelector(".display");
  const nodes = document.getElementById("nodes");
  const target = document.getElementById("target");
  const secondaryTarget = document.getElementById("target-secondary");
  const toggle = document.getElementById("toggle");
  const fullscreen = document.getElementById("fullscreen");
  const status = document.getElementById("status");
  const phase = document.getElementById("phase");
  const remaining = document.getElementById("remaining");
  const nodePositions = [];

  const phaseDuration = 60000;
  const totalDuration = phaseDuration * 2;
  const rowDuration = 20000;
  const rowOrder = [2, 0, 4];
  const singleColumns = [4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3];
  const dualOffsets = [1, 2, 3, 4, 3, 2];
  let running = false;
  let elapsed = 0;
  let previousTime = null;
  let animationId = null;
  let width = 1000;
  let height = 650;
  let marginX = 40;
  let marginY = 100;

  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (row !== 0 && row !== 2 && row !== 4 &&
          column !== 0 && column !== 4 && column !== 8) continue;

      const node = document.createElementNS(svgNamespace, "g");
      const rim = document.createElementNS(svgNamespace, "circle");
      rim.setAttribute("r", "6.4");
      rim.setAttribute("fill", "url(#metal)");
      rim.setAttribute("stroke", "#b3c39a");
      rim.setAttribute("stroke-width", ".8");
      const slot = document.createElementNS(svgNamespace, "path");
      slot.setAttribute("d", "M -1 -3 L 1 3 M -2 1 L 2 -1");
      slot.setAttribute("stroke", "#364d35");
      slot.setAttribute("stroke-width", "1.1");
      node.append(rim, slot);
      nodes.append(node);
      nodePositions.push({ node, row, column });
    }
  }

  function position(element, column, row) {
    const x = marginX + (width - marginX * 2) * column / 8;
    const y = marginY + (height - marginY * 2) * row / 4;
    element.setAttribute("transform", `translate(${x} ${y})`);
  }

  function draw() {
    const complete = elapsed >= totalDuration;
    const dual = elapsed >= phaseDuration;
    const seconds = Math.ceil((totalDuration - elapsed) / 1000);
    remaining.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    phase.textContent = complete ? "已结束" : dual ? "双点" : "单点";
    target.setAttribute("visibility", complete ? "hidden" : "visible");
    secondaryTarget.setAttribute("visibility", dual && !complete ? "visible" : "hidden");
    if (complete) return;

    const phaseTime = elapsed % phaseDuration;
    const row = rowOrder[Math.floor(phaseTime / rowDuration)];
    const rowTime = phaseTime % rowDuration;
    if (dual) {
      // Three expand/contract cycles per row, keeping two distinct lights throughout.
      const step = Math.floor(rowTime / (rowDuration / (dualOffsets.length * 3)));
      const offset = dualOffsets[step % dualOffsets.length];
      position(target, 4 - offset, row);
      position(secondaryTarget, 4 + offset, row);
    } else {
      const step = Math.floor(rowTime / (rowDuration / singleColumns.length));
      position(target, singleColumns[step], row);
    }
  }

  function layout() {
    const bounds = display.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    marginX = Math.max(48, Math.min(64, width * 0.045));
    marginY = Math.max(100, Math.min(120, height * 0.13));
    display.setAttribute("viewBox", `0 0 ${width} ${height}`);
    for (const { node, column, row } of nodePositions) position(node, column, row);
    draw();
  }

  function advance(time) {
    if (previousTime !== null) elapsed = Math.min(totalDuration, elapsed + Math.max(0, time - previousTime));
    previousTime = time;
  }

  function stopAnimation() {
    running = false;
    cancelAnimationFrame(animationId);
    animationId = null;
    previousTime = null;
    toggle.setAttribute("aria-pressed", "false");
  }

  function finish() {
    stopAnimation();
    draw();
    toggle.textContent = "再来一次";
    status.textContent = "本轮两分钟已结束，请让眼睛休息一下";
  }

  function frame(time) {
    if (!running) return;
    const wasSingle = elapsed < phaseDuration;
    advance(time);
    draw();
    if (elapsed >= totalDuration) {
      finish();
      return;
    }
    if (wasSingle && elapsed >= phaseDuration) status.textContent = "进入双点阶段：左右展开、合拢";
    animationId = requestAnimationFrame(frame);
  }

  function pause(message = "已暂停，准备好后可继续") {
    if (!running) return;
    advance(performance.now());
    if (elapsed >= totalDuration) {
      finish();
      return;
    }
    stopAnimation();
    draw();
    toggle.textContent = "继续跟随";
    status.textContent = message;
  }

  toggle.addEventListener("click", () => {
    if (running) {
      pause();
      return;
    }
    if (elapsed >= totalDuration) elapsed = 0;
    running = true;
    previousTime = performance.now();
    toggle.textContent = "暂停";
    toggle.setAttribute("aria-pressed", "true");
    status.textContent = elapsed < phaseDuration ? "单点阶段：逐格跟随绿点，保持自然眨眼" : "双点阶段：左右展开、合拢";
    draw();
    animationId = requestAnimationFrame(frame);
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.target === document.body) {
      event.preventDefault();
      toggle.click();
    }
    if (event.code === "Escape" && running) pause();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) pause("页面已离开，已自动暂停");
  });
  window.addEventListener("blur", () => {
    if (running) pause("窗口已切换，已自动暂停");
  });
  window.addEventListener("resize", () => {
    if (running) pause("显示区域已变化，已暂停");
    layout();
  });
  new ResizeObserver(layout).observe(display);
  layout();

  if (!document.fullscreenEnabled) {
    fullscreen.hidden = true;
  }
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen request failed:", error);
      status.textContent = "无法切换全屏，请使用浏览器的全屏菜单";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
    if (running) pause("全屏状态已变化，已暂停");
  });
})();
