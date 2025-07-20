"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseContextProvider = void 0;
class BaseContextProvider {
    constructor(options = {}) {
        this.options = options;
    }
    getDescription() {
        return this.constructor.description;
    }
}
exports.BaseContextProvider = BaseContextProvider;
//# sourceMappingURL=BaseContextProvider.js.map