/**
 * jsTrack: web-based Tracker (https://physlets.org/tracker/). Get position data from objects in a video.
 * Copyright (C) 2018 Luca Demian
 *
 * Main entry point - imports all modules in the correct order.
 */

// 1. Global state (project, stage, modals, etc.)
import './globals';

// 3. Compatibility / storage helpers
import './compatibility';

// 4. Scrubber UI
import './scrubber';

// 5. Main render loop and stage event handlers
import './index';

// 6. Seeking / scrubber interactions
import './seeking';

// 7. Viewport pan/zoom
import './viewport';

// 8. Project event listeners
import './projectlisteners';

// 9. Modal form event handlers
import './modalevents';

// 10. Keyboard shortcuts
import './keycommands';

// 11. Toolbar button handlers
import './buttons';

// 12. File handling (drag & drop, file input)
import './handlefiles';

// 13. Backup / localStorage persistence
import './backup';

// 14. DOM setup (resize, panel drag)
import './dom';

// 15. Google Drive integration
import './drive';
