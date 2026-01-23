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
            defaultValue: options.defaultValue || 50,
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
            const value = parseInt(this.slider.value);
            this.input.value = value;
            this.saveValue(value);
            this.options.onChange(value);
        });
        
        // Input change updates slider
        this.input.addEventListener('input', () => {
            let value = parseInt(this.input.value);
            
            // Validate and clamp value
            if (isNaN(value)) return;
            value = Math.max(this.options.min, Math.min(this.options.max, value));
            
            // Round to nearest step
            value = Math.round(value / this.options.step) * this.options.step;
            
            this.slider.value = value;
            this.input.value = value;
            this.saveValue(value);
            this.options.onChange(value);
        });
        
        // Handle manual input validation on blur
        this.input.addEventListener('blur', () => {
            let value = parseInt(this.input.value);
            
            if (isNaN(value)) {
                value = this.loadValue() || this.options.defaultValue;
            } else {
                value = Math.max(this.options.min, Math.min(this.options.max, value));
                value = Math.round(value / this.options.step) * this.options.step;
            }
            
            this.setValue(value);
        });
    }
    
    setValue(value) {
        this.slider.value = value;
        this.input.value = value;
        this.saveValue(value);
    }
    
    getValue() {
        return parseInt(this.slider.value);
    }
    
    saveValue(value) {
        localStorage.setItem(this.options.storageKey, value.toString());
    }
    
    loadValue() {
        const value = localStorage.getItem(this.options.storageKey);
        return value !== null ? parseInt(value) : null;
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
