/* Consistent line icons for the garage interface; all geometry is local. */
(function (root) {
  'use strict';
  const paths = {
    tools: '<path d="M14.4 5.1a5.2 5.2 0 0 0-6.1 6.8l-4.5 4.5a2.7 2.7 0 1 0 3.8 3.8l4.5-4.5a5.2 5.2 0 0 0 6.8-6.1l-3.3 3.3-3.5-.8-.8-3.5z"/><circle cx="5.7" cy="18.3" r=".7" fill="currentColor" stroke="none"/>',
    reliability: '<path d="M12 2.5 19.5 5v6.3c0 4.6-2.6 8.1-7.5 10.2-4.9-2.1-7.5-5.6-7.5-10.2V5z"/><path d="m8.4 11.9 2.4 2.4 4.9-5"/>',
    jack: '<path d="M3 17h14l2 2H5zM6 17l2-5h6l2 5M8 12l3-4h3M14 8l4-4M18 4l2.5 1"/><circle cx="7" cy="20" r="1.4"/><circle cx="16" cy="20" r="1.4"/>',
    crew: '<circle cx="9" cy="7" r="2.6"/><circle cx="17" cy="8" r="2.1"/><path d="M3.5 19v-1.3a5.5 5.5 0 0 1 11 0V19zM15 13a4.4 4.4 0 0 1 5.5 4.3V19h-3"/>',
    car: '<path d="M3 16.5h18l-1.2-3.3-4.1-1.3-2.3-3H9.5l-2 3-2.8.9zM7 16.5v1.8m10-1.8v1.8"/><circle cx="7" cy="18.3" r="1.7"/><circle cx="17" cy="18.3" r="1.7"/><path d="M9.5 11.9h5.6M12 9v3"/>',
    mechanic: '<path d="M5 11a7 7 0 0 1 14 0v3.3A6.7 6.7 0 0 1 12.3 21h-.6A6.7 6.7 0 0 1 5 14.3z"/><path d="M5 11.6c2.1.9 4.5 1.4 7 1.4s4.9-.5 7-1.4M8.5 6.9c.8-.7 1.9-1.1 3.1-1.2"/>',
    auto: '<path d="M5 11a7 7 0 0 1 14 0v3.3A6.7 6.7 0 0 1 12.3 21h-.6A6.7 6.7 0 0 1 5 14.3z"/><path d="M5 11.6c2.1.9 4.5 1.4 7 1.4s4.9-.5 7-1.4M13 5.7 10.6 9h2l-1 2.3 3-3.5h-2z"/>',
    engineer: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.2m0 14.6v2.2M2.5 12h2.2m14.6 0h2.2M5.3 5.3l1.6 1.6m10.2 10.2 1.6 1.6m0-13.4-1.6 1.6M6.9 17.1l-1.6 1.6"/><circle cx="12" cy="12" r="7"/>',
    strategist: '<rect x="5.5" y="4.5" width="13" height="17" rx="1.5"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 12h7M8.5 15h4m1.6 3 1.1 1.1 2-2.4"/>',
    'mode-race': '<path d="M5 21V3m0 1c4-2 6 2 10 0 2-1 3-1 4-1v10c-1 0-2 0-4 1-4 2-6-2-10 0"/><path d="M5 9c4-2 6 2 10 0 2-1 3-1 4-1M10 3v10m5-9v10"/>',
    'mode-pitstop': '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 6V3m-3 0h6m2.8 4.4 1.5-1.5M12 9v4.5l3 2"/>',
    tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.7 5.7 8 8m8 8 2.3 2.3M18.3 5.7 16 8m-8 8-2.3 2.3"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="m12 6.4 1.7 3.4 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z"/>'
  };
  function icon(name, className) {
    if (!Object.hasOwn(paths, name)) return '';
    const classes = typeof className === 'string' && /^[a-zA-Z0-9_\- ]+$/.test(className) ? className.trim() : 'garage-icon';
    return `<svg class="${classes || 'garage-icon'}" viewBox="0 0 24 24" width="24" height="24" style="fill:none;stroke:currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  }
  root.GarageIcons = Object.freeze({ icon });
})(window);
