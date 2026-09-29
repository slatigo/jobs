/* Shared sanitize-html options for job description HTML */

const cleanOpts = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4',
    'blockquote', 'a', 'code', 'pre', 'hr', 'span'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
    p: ['class'],
    li: ['class']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: require('sanitize-html').simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank'
    })
  }
};

module.exports = { cleanOpts };