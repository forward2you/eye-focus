export const SINGLE_DURATION = 60000;
export const TOTAL_DURATION = 120000;
export const BALL_SPEED = 180;
export const BALL_RADIUS = 12;
export const TRAIL_DURATION = 1800;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function getPhase(elapsed) {
  if (elapsed >= TOTAL_DURATION) return "complete";
  return elapsed >= SINGLE_DURATION ? "dual" : "single";
}

export function getBounds(width, height) {
  return { left: BALL_RADIUS, right: width - BALL_RADIUS, top: BALL_RADIUS, bottom: height - BALL_RADIUS };
}

export function resetTrail(ball) {
  ball.trail = [{ x: ball.x, y: ball.y, time: ball.age }];
}

export function createBall(bounds, random = Math.random) {
  const angle = 0.35 + random() * 0.8;
  const ball = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    vx: Math.cos(angle) * BALL_SPEED * (random() < 0.5 ? -1 : 1),
    vy: Math.sin(angle) * BALL_SPEED * (random() < 0.5 ? -1 : 1),
    age: 0,
  };
  resetTrail(ball);
  return ball;
}

export function advanceBall(ball, seconds, bounds) {
  ball.x = clamp(ball.x, bounds.left, bounds.right);
  ball.y = clamp(ball.y, bounds.top, bounds.bottom);

  // Resolve time of impact so dropped frames cannot send a ball through a wall.
  while (seconds > 0) {
    const timeX = ball.vx === 0 ? Infinity : ball.vx > 0 ? (bounds.right - ball.x) / ball.vx : (bounds.left - ball.x) / ball.vx;
    const timeY = ball.vy === 0 ? Infinity : ball.vy > 0 ? (bounds.bottom - ball.y) / ball.vy : (bounds.top - ball.y) / ball.vy;
    const collisionTime = Math.max(0, Math.min(timeX, timeY));
    const travel = Math.min(seconds, collisionTime);
    ball.x = clamp(ball.x + ball.vx * travel, bounds.left, bounds.right);
    ball.y = clamp(ball.y + ball.vy * travel, bounds.top, bounds.bottom);
    if (travel > 0) {
      ball.age += travel * 1000;
      ball.trail.push({ x: ball.x, y: ball.y, time: ball.age });
    }
    seconds -= travel;
    if (collisionTime > travel) break;

    if (Math.abs(timeX - collisionTime) < 1e-8) ball.vx *= -1;
    if (Math.abs(timeY - collisionTime) < 1e-8) ball.vy *= -1;
  }

  const cutoff = ball.age - TRAIL_DURATION;
  while (ball.trail.length > 1 && ball.trail[1].time <= cutoff) ball.trail.shift();
  const [first, second] = ball.trail;
  if (second && first.time < cutoff) {
    const progress = (cutoff - first.time) / (second.time - first.time);
    ball.trail[0] = {
      x: first.x + (second.x - first.x) * progress,
      y: first.y + (second.y - first.y) * progress,
      time: cutoff,
    };
  }
}

export function createSession(bounds, random = Math.random) {
  return { elapsed: 0, balls: [createBall(bounds, random)] };
}

export function advanceSession(session, milliseconds, bounds, random = Math.random) {
  const start = session.elapsed;
  const end = Math.min(TOTAL_DURATION, start + Math.max(0, milliseconds));
  if (start >= TOTAL_DURATION) return;

  const singleTime = Math.min(end, SINGLE_DURATION) - Math.min(start, SINGLE_DURATION);
  advanceBall(session.balls[0], singleTime / 1000, bounds);

  if (end >= SINGLE_DURATION && session.balls.length === 1) {
    const first = session.balls[0];
    const second = createBall(bounds, random);
    second.x = bounds.left + (bounds.right - bounds.left) * (first.x < second.x ? 0.75 : 0.25);
    second.y = bounds.top + (bounds.bottom - bounds.top) * (first.y < second.y ? 0.75 : 0.25);
    resetTrail(second);
    session.balls.push(second);
  }
  const dualTime = Math.max(0, end - SINGLE_DURATION) - Math.max(0, start - SINGLE_DURATION);
  if (dualTime > 0) {
    for (const ball of session.balls) advanceBall(ball, dualTime / 1000, bounds);
  }
  session.elapsed = end;
}
