/**
 * Custom Range Slider
 * Styled slider for window size control with localStorage persistence
 */

class CustomSlider {
    constructor(sliderElement, inputElement, options = {}) {
        this.slider = sliderElement;
        this.input = inputElement;
        this.options = {
            min: options.min || 0,
            max: options.max || 100,
            step: options.step || 1,
            inputStep: options.inputStep || options.step || 1,
            defaultValue: options.defaultValue || 0,
            storageKey: options.storageKey || 'sliderValue',
            onChange: options.onChange || (() => {})
        };
        
        this.init();
    }
    
    init() {
        // Load saved value from localStorage
        const savedValue = this.loadValue();
        const initialValue = savedValue !== null ? savedValue : this.options.defaultValue;
        
        // Set initial values
        this.setValue(initialValue);
        
        // Attach event listeners
        this.attachEvents();
        
        console.log('CustomSlider initialized:', {
            min: this.options.min,
            max: this.options.max,
            initialValue: initialValue
        });
    }
    
    attachEvents() {
        // Slider change updates input
        this.slider.addEventListener('input', () => {
            const value = parseFloat(this.slider.value);
            this.input.value = value;
            this.saveValue(value);
            this.options.onChange(value);
        });
        
        // Input change updates slider
        this.input.addEventListener('input', () => {
            const value = parseFloat(this.input.value);

            if (isNaN(value)) return;
            const boundedValue = Math.max(
                this.options.min,
                Math.min(this.options.max, value)
            );
            this.slider.value = this.sliderValue(boundedValue);
            this.saveValue(boundedValue);
            this.options.onChange(boundedValue);
        });
        
        // Handle manual input validation on blur
        this.input.addEventListener('blur', () => {
            let value = parseFloat(this.input.value);
            
            if (isNaN(value)) {
                value = this.loadValue() || this.options.defaultValue;
            } else {
                value = Math.max(this.options.min, Math.min(this.options.max, value));
                value = Math.round(value / this.options.inputStep) * this.options.inputStep;
            }
            
            this.setValue(value);
        });
    }
    
    setValue(value) {
        value = Math.max(this.options.min, Math.min(this.options.max, value));
        value = Math.round(value / this.options.inputStep) * this.options.inputStep;
        this.slider.value = this.sliderValue(value);
        this.input.value = value;
        this.saveValue(value);
    }

    sliderValue(value) {
        const steppedValue = this.options.min
            + Math.round((value - this.options.min) / this.options.step) * this.options.step;
        return Math.max(this.options.min, Math.min(this.options.max, steppedValue));
    }
    
    getValue() {
        return parseFloat(this.slider.value);
    }
    
    saveValue(value) {
        localStorage.setItem(this.options.storageKey, value.toString());
    }
    
    loadValue() {
        const value = localStorage.getItem(this.options.storageKey);
        return value !== null ? parseFloat(value) : null;
    }
    
    updateLimits(min, max) {
        this.options.min = min;
        this.options.max = max;
        this.slider.min = min;
        this.slider.max = max;
        this.input.min = min;
        this.input.max = max;
        
        // Clamp current value to new limits
        const currentValue = this.getValue();
        if (currentValue < min || currentValue > max) {
            this.setValue(Math.max(min, Math.min(max, currentValue)));
        }
    }
}
