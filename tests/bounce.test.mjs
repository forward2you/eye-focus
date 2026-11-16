import test from "node:test";
import assert from "node:assert/strict";
import { advanceBall, advanceSession, BALL_RADIUS, BALL_SPEED, createBall, createSession, getBounds, getPhase, resetTrail, TRAIL_DURATION } from "../bounce/motion.mjs";

const bounds = getBounds(1280, 800);
const fixedRandom = () => 0.5;
const speed = ball => Math.hypot(ball.vx, ball.vy);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("balls start at a fixed speed and stay bounded over a long frame", () => {
  const ball = createBall(bounds, fixedRandom);
  close(speed(ball), BALL_SPEED);
  advanceBall(ball, 120, bounds);
  assert.ok(ball.x >= bounds.left && ball.x <= bounds.right);
  assert.ok(ball.y >= bounds.top && ball.y <= bounds.bottom);
  close(speed(ball), BALL_SPEED);
});

test("each wall and exact corners reflect the ball inward", () => {
  for (const [x, y, vx, vy, signX, signY] of [
    [bounds.right, 400, 60, 60, -1, 1],
    [bounds.left, 400, -60, 60, 1, 1],
    [600, bounds.top, 60, -60, 1, 1],
    [600, bounds.bottom, 60, 60, 1, -1],
    [bounds.right, bounds.bottom, 60, 60, -1, -1],
    [bounds.left, bounds.top, -60, -60, 1, 1],
  ]) {
    const ball = Object.assign(createBall(bounds, fixedRandom), { x, y, vx, vy });
    resetTrail(ball);
    advanceBall(ball, 0.1, bounds);
    assert.equal(Math.sign(ball.vx), signX);
    assert.equal(Math.sign(ball.vy), signY);
    close(ball.vx, Math.abs(vx) * signX);
    close(ball.vy, Math.abs(vy) * signY);
  }
});

test("repeated billiard reflections preserve speed and component magnitudes", () => {
  const ball = createBall(bounds, fixedRandom);
  const { vx, vy } = ball;
  for (let index = 0; index < 300; index += 1) {
    advanceBall(ball, 1, bounds);
    assert.ok(ball.x >= bounds.left && ball.x <= bounds.right);
    assert.ok(ball.y >= bounds.top && ball.y <= bounds.bottom);
    close(speed(ball), BALL_SPEED);
    close(Math.abs(ball.vx), Math.abs(vx));
    close(Math.abs(ball.vy), Math.abs(vy));
  }
});

test("one ball before 60 seconds, two at 60 seconds, done at 120 seconds", () => {
  const session = createSession(bounds, fixedRandom);
  advanceSession(session, 59999, bounds, fixedRandom);
  assert.equal(getPhase(session.elapsed), "single");
  assert.equal(session.balls.length, 1);
  advanceSession(session, 1, bounds, fixedRandom);
  assert.equal(getPhase(session.elapsed), "dual");
  assert.equal(session.balls.length, 2);
  assert.notDeepEqual(session.balls[0], session.balls[1]);
  advanceSession(session, 59999, bounds, fixedRandom);
  assert.equal(getPhase(session.elapsed), "dual");
  advanceSession(session, 1, bounds, fixedRandom);
  assert.equal(getPhase(session.elapsed), "complete");
  const completed = structuredClone(session);
  advanceSession(session, 30000, bounds, fixedRandom);
  assert.deepEqual(session, completed);
});

test("a frame crossing the phase boundary simulates both time intervals", () => {
  const whole = createSession(bounds, fixedRandom);
  const split = createSession(bounds, fixedRandom);
  advanceSession(whole, 61000, bounds, fixedRandom);
  advanceSession(split, 60000, bounds, fixedRandom);
  advanceSession(split, 1000, bounds, fixedRandom);
  for (let index = 0; index < 2; index += 1) {
    close(whole.balls[index].x, split.balls[index].x);
    close(whole.balls[index].y, split.balls[index].y);
  }
});

test("a long suspended frame clamps to two minutes and new sessions reset", () => {
  const session = createSession(bounds, fixedRandom);
  advanceSession(session, 600000, bounds, fixedRandom);
  assert.equal(session.elapsed, 120000);
  assert.equal(session.balls.length, 2);
  const fresh = createSession(bounds, fixedRandom);
  assert.equal(fresh.elapsed, 0);
  assert.equal(fresh.balls.length, 1);
});

test("mobile and landscape bounds let the ball body touch every viewport edge", () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]]) {
    const area = getBounds(width, height);
    const ball = createBall(area, fixedRandom);
    assert.deepEqual(area, { left: BALL_RADIUS, right: width - BALL_RADIUS, top: BALL_RADIUS, bottom: height - BALL_RADIUS });
    advanceBall(ball, 120, area);
    assert.ok(ball.x >= BALL_RADIUS && ball.x + BALL_RADIUS <= width);
    assert.ok(ball.y >= BALL_RADIUS && ball.y + BALL_RADIUS <= height);
  }
});

test("speed is exactly 180 pixels per second and reflection occurs at contact", () => {
  assert.equal(BALL_SPEED, 180);
  const ball = createBall(bounds, fixedRandom);
  Object.assign(ball, { x: bounds.right - BALL_SPEED, y: 400, vx: BALL_SPEED, vy: 0 });
  resetTrail(ball);
  advanceBall(ball, 0.5, bounds);
  close(ball.x, bounds.right - 90);
  assert.equal(ball.vx, 180);
  advanceBall(ball, 0.5, bounds);
  close(ball.x + BALL_RADIUS, 1280);
  assert.equal(ball.vx, -180);
  advanceBall(ball, 0.5, bounds);
  close(ball.x, bounds.right - 90);
  close(ball.y, 400);
});

test("trail includes exact wall contact rather than cutting across the bounce", () => {
  const ball = createBall(bounds, fixedRandom);
  Object.assign(ball, { x: bounds.right - 18, y: 400, vx: BALL_SPEED, vy: 0 });
  resetTrail(ball);
  advanceBall(ball, 0.2, bounds);
  assert.equal(ball.trail.length, 3);
  close(ball.trail[1].x, bounds.right);
  close(ball.trail[1].time, 100);
  close(ball.trail[2].x, bounds.right - 18);
  close(ball.trail[2].time, 200);
});

test("trail keeps only the last 1.8 seconds even after a long frame", () => {
  const ball = createBall(bounds, fixedRandom);
  advanceBall(ball, 100, bounds);
  close(ball.age, 100000);
  close(ball.trail[0].time, ball.age - TRAIL_DURATION);
  close(ball.trail.at(-1).time, ball.age);
  for (let frame = 0; frame < 1000; frame += 1) advanceBall(ball, 0.016, bounds);
  assert.ok(ball.trail.length < 120);
  assert.ok(ball.trail.every(point => point.time >= ball.age - TRAIL_DURATION - 1e-7));
});

test("resizing or repositioning resets the trail without changing ball age", () => {
  const ball = createBall(bounds, fixedRandom);
  advanceBall(ball, 1, bounds);
  ball.x = bounds.left;
  resetTrail(ball);
  assert.deepEqual(ball.trail, [{ x: bounds.left, y: ball.y, time: ball.age }]);
});
