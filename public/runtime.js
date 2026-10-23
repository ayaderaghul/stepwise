// Minimal stand-in for the design tool's component base class.
// logic.js defines `class Component extends DCLogic`; setState here schedules a re-render.
class DCLogic {
  constructor() {
    this.props = {};
    this.state = null;
    this.onChange = null;
  }
  setState(patch) {
    this.state = Object.assign({}, this.state, patch);
    if (this.onChange) this.onChange();
  }
}
