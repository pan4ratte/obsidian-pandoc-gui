/**
 * The pandoc logo by Albert Krewinkel (https://github.com/tarleb/pandoc-logo), CC BY-SA 4.0: the reverse pilcrow and
 * the document fold, without the background and in the current colour. Not an official logo of pandoc's.
 */
export default () => (
  <div>
    <svg class="svg-icon ex-pandoc-logo" viewBox="0 0 100 100">
      <g
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="6"
        transform="skewX(-6) translate(8 1)"
      >
        <path d="M 30,10 l 0,80 M 45,10 l 0,80 M 20,10 l 40,0 l 18,18 l 0,25 l -33,0" />
        <path fill="currentColor" stroke-width="4" d="M 61,10 l 17,17 l -17,0 l 0,-17" />
      </g>
    </svg>
  </div>
);
