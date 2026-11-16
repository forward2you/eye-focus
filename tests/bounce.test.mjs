import test from "node:test";
import assert from "node:assert/strict";
import { advanceBall, advanceSession, BALL_SPEED, createBall, createSession, getBounds, getPhase } from "../bounce/motion.mjs";

const bounds = getBounds(1280, 800);
const fixedRandom = () => 0.5;
const speed = ball => Math.hypot(ball.vx, ball.vy);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("balls start at a fixed speed and stay bounded over a long frame", () => {
  const ball = createBall(bounds, fixedRandom);
  close(speed(ball), BALL_SPEED);
  advanceBall(ball, 120, bounds, fixedRandom);
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
    const ball = { x, y, vx, vy };
    advanceBall(ball, 0.1, bounds, fixedRandom);
    assert.equal(Math.sign(ball.vx), signX);
    assert.equal(Math.sign(ball.vy), signY);
    close(speed(ball), BALL_SPEED);
  }
});

test("small random changes on collision never accelerate the ball", () => {
  const ball = createBall(bounds, fixedRandom);
  for (let index = 0; index < 300; index += 1) {
    advanceBall(ball, 1, bounds, () => index % 2);
    assert.ok(ball.x >= bounds.left && ball.x <= bounds.right);
    assert.ok(ball.y >= bounds.top && ball.y <= bounds.bottom);
    close(speed(ball), BALL_SPEED);
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

test("mobile and landscape fields retain room for the entire glow", () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]]) {
    const area = getBounds(width, height);
    const ball = createBall(area, fixedRandom);
    advanceBall(ball, 120, area, fixedRandom);
    assert.ok(ball.x >= 38 && ball.x + 38 <= width);
    assert.ok(ball.y >= 38 && ball.y + 38 <= height);
  }
});
