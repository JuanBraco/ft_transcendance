export class GameState {
  private xBall: number;
  private yBall: number;
  private xSpeed: number;
  private ySpeed: number;
  private yPadR: number;
  private yPadL: number;
  private scoreL: number;
  private scoreR: number;
  private isSpeed: boolean;

  private readonly canvasWidth: number;
  private readonly canvasHeight: number;

  constructor() {
    // Initialize the game state
    this.canvasWidth = 1;
    this.canvasHeight = 1;
    this.yPadR = this.canvasHeight / 2;
    this.yPadL = this.canvasHeight / 2;
    this.scoreL = 0;
    this.scoreR = 0;
    this.resetBallPositionAndSpeed();
  }

  public update(): void {
    this.xBall += this.xSpeed;
    this.yBall += this.ySpeed;

    if (this.yBall <= 0 || this.yBall >= this.canvasHeight) this.ySpeed = -this.ySpeed;
    this.handlePaddleCollision('left');
    this.handlePaddleCollision('right');
  }

  public updatePaddlePosition(yPadR: number, yPadL: number): void {
    if (yPadL) this.yPadL = yPadL;
    if (yPadR) this.yPadR = yPadR;
  }

  public updateSpeedMode(isSpeed: boolean): void {
    if (isSpeed) this.isSpeed = isSpeed;
  }

  public getState(): any {
    return {
      yBall: this.yBall,
      xBall: this.xBall,
      yPadR: this.yPadR,
      yPadL: this.yPadL,
      scoreL: this.scoreL,
      scoreR: this.scoreR,
      isSpeed: this.isSpeed,
    };
  }

  private handlePaddleCollision(paddleSide: 'left' | 'right'): void {
    const padW = this.canvasWidth * 0.0167;
    const padH = this.canvasHeight * 0.2;
    const diam = this.canvasWidth * 0.0125;
    const paddleXPos = paddleSide === 'left' ? 0 : this.canvasWidth - padW;
    const yPaddle = paddleSide === 'left' ? this.yPadL : this.yPadR;
    const beyondPaddle = paddleSide === 'left' ? this.xBall < diam / 2 : this.xBall + diam / 2 > this.canvasWidth;
    const collisionXCond = paddleSide === 'left' ? this.xBall <= paddleXPos + padW : this.xBall >= paddleXPos;

    if (collisionXCond && this.yBall >= yPaddle - padW && this.yBall <= yPaddle + padH) {
      this.ySpeed = this.yBall < yPaddle + padH / 2 ? -Math.abs(this.ySpeed) : Math.abs(this.ySpeed);
      this.xSpeed = -this.xSpeed;

      if (this.isSpeed) {
        this.ySpeed *= 1.25;
        this.xSpeed *= 1.25;
      }
    } else if (beyondPaddle) {
      paddleSide === 'right' ? (this.scoreL += 1) : (this.scoreR += 1);
      this.resetBallPositionAndSpeed();
    }
  }

  private resetBallPositionAndSpeed() {
    const diam = this.canvasWidth * 0.0125;
    this.xBall = this.canvasWidth / 2 - diam / 2;
    this.yBall = this.canvasHeight / 2;

    this.xSpeed = this.canvasWidth * 0.005;
    this.ySpeed = this.canvasHeight * 0.005;
    this.isSpeed = false;
  }
}
