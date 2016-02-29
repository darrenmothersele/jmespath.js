(function(exports) {
  "use strict";

  function isArray(obj) {
    if (obj !== null) {
      return Object.prototype.toString.call(obj) === "[object Array]";
    } else {
      return false;
    }
  }

  function isObject(obj) {
    if (obj !== null) {
      return Object.prototype.toString.call(obj) === "[object Object]";
    } else {
      return false;
    }
  }

  function strictDeepEqual(first, second) {
    // Check the scalar case first.
    if (first === second) {
      return true;
    }

    // Check if they are the same type.
    var firstType = Object.prototype.toString.call(first);
    if (firstType !== Object.prototype.toString.call(second)) {
      return false;
    }
    // We know that first and second have the same type so we can just check the
    // first type from now on.
    if (isArray(first) === true) {
      // Short circuit if they're not the same length;
      if (first.length !== second.length) {
        return false;
      }
      for (var i = 0; i < first.length; i++) {
        if (strictDeepEqual(first[i], second[i]) === false) {
          return false;
        }
      }
      return true;
    }
    if (isObject(first) === true) {
      // An object is equal if it has the same key/value pairs.
      var keysSeen = {};
      for (var key in first) {
        if (hasOwnProperty.call(first, key)) {
          if (strictDeepEqual(first[key], second[key]) === false) {
            return false;
          }
          keysSeen[key] = true;
        }
      }
      // Now check that there aren't any keys in second that weren't
      // in first.
      for (var key2 in second) {
        if (hasOwnProperty.call(second, key2)) {
          if (keysSeen[key2] !== true) {
            return false;
          }
        }
      }
      return true;
    }
    return false;
  }

  function isFalse(obj) {
    // From the spec:
    // A false value corresponds to the following values:
    // Empty list
    // Empty object
    // Empty string
    // False boolean
    // null value

    // First check the scalar values.
    if (obj === "" || obj === false || obj === null) {
        return true;
    } else if (isArray(obj) && obj.length === 0) {
        // Check for an empty array.
        return true;
    } else if (isObject(obj)) {
        // Check for an empty object.
        for (var key in obj) {
            // If there are any keys, then
            // the object is not empty so the object
            // is not false.
            if (obj.hasOwnProperty(key)) {
              return false;
            }
        }
        return true;
    } else {
        return false;
    }
  }

  function objValues(obj) {
    var keys = Object.keys(obj);
    var values = [];
    for (var i = 0; i < keys.length; i++) {
      values.push(obj[keys[i]]);
    }
    return values;
  }

  function merge(a, b) {
      var merged = {};
      for (var key in a) {
          merged[key] = a[key];
      }
      for (var key2 in b) {
          merged[key2] = b[key2];
      }
      return merged;
  }

  var trimLeft;
  if (typeof String.prototype.trimLeft === "function") {
    trimLeft = function(str) {
      return str.trimLeft();
    };
  } else {
    trimLeft = function(str) {
      return str.match(/^\s*(.*)/)[1];
    };
  }

  // Type constants used to define functions.
  var TYPE_NUMBER = 0;
  var TYPE_ANY = 1;
  var TYPE_STRING = 2;
  var TYPE_ARRAY = 3;
  var TYPE_OBJECT = 4;
  var TYPE_BOOLEAN = 5;
  var TYPE_EXPREF = 6;
  var TYPE_NULL = 7;
  var TYPE_ARRAY_NUMBER = 8;
  var TYPE_ARRAY_STRING = 9;

  var TOK_EOF = "EOF";
  var TOK_UNQUOTEDIDENTIFIER = "UnquotedIdentifier";
  var TOK_QUOTEDIDENTIFIER = "QuotedIdentifier";
  var TOK_RBRACKET = "Rbracket";
  var TOK_RPAREN = "Rparen";
  var TOK_COMMA = "Comma";
  var TOK_COLON = "Colon";
  var TOK_RBRACE = "Rbrace";
  var TOK_NUMBER = "Number";
  var TOK_CURRENT = "Current";
  var TOK_EXPREF = "Expref";
  var TOK_PIPE = "Pipe";
  var TOK_OR = "Or";
  var TOK_AND = "And";
  var TOK_EQ = "EQ";
  var TOK_GT = "GT";
  var TOK_LT = "LT";
  var TOK_GTE = "GTE";
  var TOK_LTE = "LTE";
  var TOK_NE = "NE";
  var TOK_FLATTEN = "Flatten";
  var TOK_STAR = "Star";
  var TOK_FILTER = "Filter";
  var TOK_DOT = "Dot";
  var TOK_NOT = "Not";
  var TOK_LBRACE = "Lbrace";
  var TOK_LBRACKET = "Lbracket";
  var TOK_LPAREN= "Lparen";
  var TOK_LITERAL= "Literal";

  // The "&", "[", "<", ">" tokens
  // are not in basicToken because
  // there are two token variants
  // ("&&", "[?", "<=", ">=").  This is specially handled
  // below.

  var basicTokens = {
    ".": TOK_DOT,
    "*": TOK_STAR,
    ",": TOK_COMMA,
    ":": TOK_COLON,
    "{": TOK_LBRACE,
    "}": TOK_RBRACE,
    "]": TOK_RBRACKET,
    "(": TOK_LPAREN,
    ")": TOK_RPAREN,
    "@": TOK_CURRENT
  };

  var operatorStartToken = {
      "<": true,
      ">": true,
      "=": true,
      "!": true
  };

  var numbers = {
      0: true,
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
      8: true,
      9: true,
      "-": true
  };

  var skipChars = {
      " ": true,
      "\t": true,
      "\n": true
  };


  function isAlpha(ch) { 
      return (ch >= "a" && ch <= "z") ||
             (ch >= "A" && ch <= "Z") ||
             ch === "_"
  }

  function isAlphaNum(ch) {
      return (ch >= "a" && ch <= "z") ||
             (ch >= "A" && ch <= "Z") ||
             (ch >= "0" && ch <= "9") ||
             ch === "_"
  }

  function Lexer() {
  }
  Lexer.prototype = {
      tokenize: function(stream) {
          var tokens = [];
          this.current = 0;
          var start;
          var identifier;
          var token;
          while (this.current < stream.length) {
              if (isAlpha(stream[this.current])) {
                  start = this.current;
                  identifier = this.consumeUnquotedIdentifier(stream);
                  tokens.push({type: TOK_UNQUOTEDIDENTIFIER,
                               value: identifier,
                               start: start});
              } else if (basicTokens[stream[this.current]] !== undefined) {
                  tokens.push({type: basicTokens[stream[this.current]],
                              value: stream[this.current],
                              start: this.current});
                  this.current++;
              } else if (numbers[stream[this.current]] !== undefined) {
                  token = this.consumeNumber(stream);
                  tokens.push(token);
              } else if (stream[this.current] === "[") {
                  // No need to increment this.current.  This happens
                  // in consumeLBracket
                  token = this.consumeLBracket(stream);
                  tokens.push(token);
              } else if (stream[this.current] === "\"") {
                  start = this.current;
                  identifier = this.consumeQuotedIdentifier(stream);
                  tokens.push({type: TOK_QUOTEDIDENTIFIER,
                               value: identifier,
                               start: start});
              } else if (stream[this.current] === "'") {
                  start = this.current;
                  identifier = this.consumeRawStringLiteral(stream);
                  tokens.push({type: TOK_LITERAL,
                               value: identifier,
                               start: start});
              } else if (stream[this.current] === "`") {
                  start = this.current;
                  var literal = this.consumeLiteral(stream);
                  tokens.push({type: TOK_LITERAL,
                               value: literal,
                               start: start});
              } else if (operatorStartToken[stream[this.current]] !== undefined) {
                  tokens.push(this.consumeOperator(stream));
              } else if (skipChars[stream[this.current]] !== undefined) {
                  // Ignore whitespace.
                  this.current++;
              } else if (stream[this.current] === "&") {
                  start = this.current;
                  this.current++;
                  if (stream[this.current] === "&") {
                      this.current++;
                      tokens.push({type: TOK_AND, value: "&&", start: start});
                  } else {
                      tokens.push({type: TOK_EXPREF, value: "&", start: start});
                  }
              } else if (stream[this.current] === "|") {
                  start = this.current;
                  this.current++;
                  if (stream[this.current] === "|") {
                      this.current++;
                      tokens.push({type: TOK_OR, value: "||", start: start});
                  } else {
                      tokens.push({type: TOK_PIPE, value: "|", start: start});
                  }
              } else {
                  var error = new Error("Unknown character:" + stream[this.current]);
                  error.name = "LexerError";
                  throw error;
              }
          }
          return tokens;
      },

      consumeUnquotedIdentifier: function(stream) {
          var start = this.current;
          this.current++;
          while (this.current < stream.length && isAlphaNum(stream[this.current])) {
              this.current++;
          }
          return stream.slice(start, this.current);
      },

      consumeQuotedIdentifier: function(stream) {
          var start = this.current;
          this.current++;
          var maxLength = stream.length;
          while (stream[this.current] !== "\"" && this.current < maxLength) {
              // You can escape a double quote and you can escape an escape.
              var current = this.current;
              if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
                                               stream[current + 1] === "\"")) {
                  current += 2;
              } else {
                  current++;
              }
              this.current = current;
          }
          this.current++;
          return JSON.parse(stream.slice(start, this.current));
      },

      consumeRawStringLiteral: function(stream) {
          var start = this.current;
          this.current++;
          var maxLength = stream.length;
          while (stream[this.current] !== "'" && this.current < maxLength) {
              // You can escape a single quote and you can escape an escape.
              var current = this.current;
              if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
                                               stream[current + 1] === "'")) {
                  current += 2;
              } else {
                  current++;
              }
              this.current = current;
          }
          this.current++;
          var literal = stream.slice(start + 1, this.current - 1);
          return literal.replace("\\'", "'");
      },

      consumeNumber: function(stream) {
          var start = this.current;
          this.current++;
          var maxLength = stream.length;
          while (numbers[stream[this.current]] !== undefined && this.current < maxLength) {
              this.current++;
          }
          var value = parseInt(stream.slice(start, this.current));
          return {type: TOK_NUMBER, value: value, start: start};
      },

      consumeLBracket: function(stream) {
          var start = this.current;
          this.current++;
          if (stream[this.current] === "?") {
              this.current++;
              return {type: TOK_FILTER, value: "[?", start: start};
          } else if (stream[this.current] === "]") {
              this.current++;
              return {type: TOK_FLATTEN, value: "[]", start: start};
          } else {
              return {type: TOK_LBRACKET, value: "[", start: start};
          }
      },

      consumeOperator: function(stream) {
          var start = this.current;
          var startingChar = stream[start];
          this.current++;
          if (startingChar === "!") {
              if (stream[this.current] === "=") {
                  this.current++;
                  return {type: TOK_NE, value: "!=", start: start};
              } else {
                return {type: TOK_NOT, value: "!", start: start};
              }
          } else if (startingChar === "<") {
              if (stream[this.current] === "=") {
                  this.current++;
                  return {type: TOK_LTE, value: "<=", start: start};
              } else {
                  return {type: TOK_LT, value: "<", start: start};
              }
          } else if (startingChar === ">") {
              if (stream[this.current] === "=") {
                  this.current++;
                  return {type: TOK_GTE, value: ">=", start: start};
              } else {
                  return {type: TOK_GT, value: ">", start: start};
              }
          } else if (startingChar === "=") {
              if (stream[this.current] === "=") {
                  this.current++;
                  return {type: TOK_EQ, value: "==", start: start};
              }
          }
      },

      consumeLiteral: function(stream) {
          this.current++;
          var start = this.current;
          var maxLength = stream.length;
          var literal;
          while(stream[this.current] !== "`" && this.current < maxLength) {
              // You can escape a literal char or you can escape the escape.
              var current = this.current;
              if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
                                               stream[current + 1] === "`")) {
                  current += 2;
              } else {
                  current++;
              }
              this.current = current;
          }
          var literalString = trimLeft(stream.slice(start, this.current));
          literalString = literalString.replace("\\`", "`");
          if (this.looksLikeJSON(literalString)) {
              literal = JSON.parse(literalString);
          } else {
              // Try to JSON parse it as "<literal>"
              literal = JSON.parse("\"" + literalString + "\"");
          }
          // +1 gets us to the ending "`", +1 to move on to the next char.
          this.current++;
          return literal;
      },

      looksLikeJSON: function(literalString) {
          var startingChars = "[{\"";
          var jsonLiterals = ["true", "false", "null"];
          var numberLooking = "-0123456789";

          if (literalString === "") {
              return false;
          } else if (startingChars.indexOf(literalString[0]) >= 0) {
              return true;
          } else if (jsonLiterals.indexOf(literalString) >= 0) {
              return true;
          } else if (numberLooking.indexOf(literalString[0]) >= 0) {
              try {
                  JSON.parse(literalString);
                  return true;
              } catch (ex) {
                  return false;
              }
          } else {
              return false;
          }
      }
  };

      var bindingPower = {};
      bindingPower[TOK_EOF] = 0;
      bindingPower[TOK_UNQUOTEDIDENTIFIER] = 0;
      bindingPower[TOK_QUOTEDIDENTIFIER] = 0;
      bindingPower[TOK_RBRACKET] = 0;
      bindingPower[TOK_RPAREN] = 0;
      bindingPower[TOK_COMMA] = 0;
      bindingPower[TOK_RBRACE] = 0;
      bindingPower[TOK_NUMBER] = 0;
      bindingPower[TOK_CURRENT] = 0;
      bindingPower[TOK_EXPREF] = 0;
      bindingPower[TOK_PIPE] = 1;
      bindingPower[TOK_OR] = 2;
      bindingPower[TOK_AND] = 3;
      bindingPower[TOK_EQ] = 5;
      bindingPower[TOK_GT] = 5;
      bindingPower[TOK_LT] = 5;
      bindingPower[TOK_GTE] = 5;
      bindingPower[TOK_LTE] = 5;
      bindingPower[TOK_NE] = 5;
      bindingPower[TOK_FLATTEN] = 9;
      bindingPower[TOK_STAR] = 20;
      bindingPower[TOK_FILTER] = 21;
      bindingPower[TOK_DOT] = 40;
      bindingPower[TOK_NOT] = 45;
      bindingPower[TOK_LBRACE] = 50;
      bindingPower[TOK_LBRACKET] = 55;
      bindingPower[TOK_LPAREN] = 60;

  function Parser() {
  }

  Parser.prototype = {
      parse: function(expression) {
          this.loadTokens(expression);
          this.index = 0;
          var ast = this.expression(0);
          if (this.lookahead(0) !== TOK_EOF) {
              var t = this.lookaheadToken(0);
              var error = new Error(
                  "Unexpected token type: " + t.type + ", value: " + t.value);
              error.name = "ParserError";
              throw error;
          }
          return ast;
      },

      loadTokens: function(expression) {
          var lexer = new Lexer();
          var tokens = lexer.tokenize(expression);
          tokens.push({type: TOK_EOF, value: "", start: expression.length});
          this.tokens = tokens;
      },

      expression: function(rbp) {
          var leftToken = this.lookaheadToken(0);
          this.advance();
          var left = this.nud(leftToken);
          var currentToken = this.lookahead(0);
          while (rbp < bindingPower[currentToken]) {
              this.advance();
              left = this.led(currentToken, left);
              currentToken = this.lookahead(0);
          }
          return left;
      },

      lookahead: function(number) {
          return this.tokens[this.index + number].type;
      },

      lookaheadToken: function(number) {
          return this.tokens[this.index + number];
      },

      advance: function() {
          this.index++;
      },

      nud: function(token) {
        var left;
        var right;
        var expression;
        switch (token.type) {
          case TOK_LITERAL:
            return {type: "Literal", value: token.value};
          case TOK_UNQUOTEDIDENTIFIER:
            return {type: "Field", name: token.value};
          case TOK_QUOTEDIDENTIFIER:
            var node = {type: "Field", name: token.value};
            if (this.lookahead(0) === TOK_LPAREN) {
                throw new Error("Quoted identifier not allowed for function names.");
            } else {
                return node;
            }
            break;
          case TOK_NOT:
            right = this.expression(bindingPower.Not);
            return {type: "NotExpression", children: [right]};
          case TOK_STAR:
            left = {type: "Identity"};
            right = null;
            if (this.lookahead(0) === TOK_RBRACKET) {
                // This can happen in a multiselect,
                // [a, b, *]
                right = {type: "Identity"};
            } else {
                right = this.parseProjectionRHS(bindingPower.Star);
            }
            return {type: "ValueProjection", children: [left, right]};
          case TOK_FILTER:
            return this.led(token.type, {type: "Identity"});
          case TOK_LBRACE:
            return this.parseMultiselectHash();
          case TOK_FLATTEN:
            left = {type: TOK_FLATTEN, children: [{type: "Identity"}]};
            right = this.parseProjectionRHS(bindingPower.Flatten);
            return {type: "Projection", children: [left, right]};
          case TOK_LBRACKET:
            if (this.lookahead(0) === TOK_NUMBER || this.lookahead(0) === TOK_COLON) {
                right = this.parseIndexExpression();
                return this.projectIfSlice({type: "Identity"}, right);
            } else if (this.lookahead(0) === TOK_STAR &&
                       this.lookahead(1) === TOK_RBRACKET) {
                this.advance();
                this.advance();
                right = this.parseProjectionRHS(bindingPower.Star);
                return {type: "Projection",
                        children: [{type: "Identity"}, right]};
            } else {
                return this.parseMultiselectList();
            }
            break;
          case TOK_CURRENT:
            return {type: TOK_CURRENT};
          case TOK_EXPREF:
            expression = this.expression(bindingPower.Expref);
            return {type: "ExpressionReference", children: [expression]};
          case TOK_LPAREN:
            var args = [];
            while (this.lookahead(0) !== TOK_RPAREN) {
              if (this.lookahead(0) === TOK_CURRENT) {
                expression = {type: TOK_CURRENT};
                this.advance();
              } else {
                expression = this.expression(0);
              }
              args.push(expression);
            }
            this.match(TOK_RPAREN);
            return args[0];
          default:
            this.errorToken(token);
        }
      },

      led: function(tokenName, left) {
        var right;
        switch(tokenName) {
          case TOK_DOT:
            var rbp = bindingPower.Dot;
            if (this.lookahead(0) !== TOK_STAR) {
                right = this.parseDotRHS(rbp);
                return {type: "Subexpression", children: [left, right]};
            } else {
                // Creating a projection.
                this.advance();
                right = this.parseProjectionRHS(rbp);
                return {type: "ValueProjection", children: [left, right]};
            }
            break;
          case TOK_PIPE:
            right = this.expression(bindingPower.Pipe);
            return {type: TOK_PIPE, children: [left, right]};
          case TOK_OR:
            right = this.expression(bindingPower.Or);
            return {type: "OrExpression", children: [left, right]};
          case TOK_AND:
            right = this.expression(bindingPower.And);
            return {type: "AndExpression", children: [left, right]};
          case TOK_LPAREN:
            var name = left.name;
            var args = [];
            var expression, node;
            while (this.lookahead(0) !== TOK_RPAREN) {
              if (this.lookahead(0) === TOK_CURRENT) {
                expression = {type: TOK_CURRENT};
                this.advance();
              } else {
                expression = this.expression(0);
              }
              if (this.lookahead(0) === TOK_COMMA) {
                this.match(TOK_COMMA);
              }
              args.push(expression);
            }
            this.match(TOK_RPAREN);
            node = {type: "Function", name: name, children: args};
            return node;
          case TOK_FILTER:
            var condition = this.expression(0);
            this.match(TOK_RBRACKET);
            if (this.lookahead(0) === TOK_FLATTEN) {
              right = {type: "Identity"};
            } else {
              right = this.parseProjectionRHS(bindingPower.Filter);
            }
            return {type: "FilterProjection", children: [left, right, condition]};
          case TOK_FLATTEN:
            var leftNode = {type: TOK_FLATTEN, children: [left]};
            var rightNode = this.parseProjectionRHS(bindingPower.Flatten);
            return {type: "Projection", children: [leftNode, rightNode]};
          case TOK_EQ:
          case TOK_NE:
          case TOK_GT:
          case TOK_GTE:
          case TOK_LT:
          case TOK_LTE:
            return this.parseComparator(left, tokenName);
          case TOK_LBRACKET:
            var token = this.lookaheadToken(0);
            if (token.type === TOK_NUMBER || token.type === TOK_COLON) {
                right = this.parseIndexExpression();
                return this.projectIfSlice(left, right);
            } else {
                this.match(TOK_STAR);
                this.match(TOK_RBRACKET);
                right = this.parseProjectionRHS(bindingPower.Star);
                return {type: "Projection", children: [left, right]};
            }
            break;
          default:
            this.errorToken(this.lookaheadToken(0));
        }
      },

      match: function(tokenType) {
          if (this.lookahead(0) === tokenType) {
              this.advance();
          } else {
              var t = this.lookaheadToken(0);
              var error = new Error("Expected " + tokenType + ", got: " + t.type);
              error.name = "ParserError";
              throw error;
          }
      },

      errorToken: function(token) {
          var error = new Error("Invalid token (" +
                                token.type + "): \"" +
                                token.value + "\"");
          error.name = "ParserError";
          throw error;
      },


      parseIndexExpression: function() {
          if (this.lookahead(0) === TOK_COLON || this.lookahead(1) === TOK_COLON) {
              return this.parseSliceExpression();
          } else {
              var node = {
                  type: "Index",
                  value: this.lookaheadToken(0).value};
              this.advance();
              this.match(TOK_RBRACKET);
              return node;
          }
      },

      projectIfSlice: function(left, right) {
          var indexExpr = {type: "IndexExpression", children: [left, right]};
          if (right.type === "Slice") {
              return {
                  type: "Projection",
                  children: [indexExpr, this.parseProjectionRHS(bindingPower.Star)]
              };
          } else {
              return indexExpr;
          }
      },

      parseSliceExpression: function() {
          // [start:end:step] where each part is optional, as well as the last
          // colon.
          var parts = [null, null, null];
          var index = 0;
          var currentToken = this.lookahead(0);
          while (currentToken !== TOK_RBRACKET && index < 3) {
              if (currentToken === TOK_COLON) {
                  index++;
                  this.advance();
              } else if (currentToken === TOK_NUMBER) {
                  parts[index] = this.lookaheadToken(0).value;
                  this.advance();
              } else {
                  var t = this.lookahead(0);
                  var error = new Error("Syntax error, unexpected token: " +
                                        t.value + "(" + t.type + ")");
                  error.name = "Parsererror";
                  throw error;
              }
              currentToken = this.lookahead(0);
          }
          this.match(TOK_RBRACKET);
          return {
              type: "Slice",
              children: parts
          };
      },

      parseComparator: function(left, comparator) {
        var right = this.expression(bindingPower[comparator]);
        return {type: "Comparator", name: comparator, children: [left, right]};
      },

      parseDotRHS: function(rbp) {
          var lookahead = this.lookahead(0);
          var exprTokens = [TOK_UNQUOTEDIDENTIFIER, TOK_QUOTEDIDENTIFIER, TOK_STAR];
          if (exprTokens.indexOf(lookahead) >= 0) {
              return this.expression(rbp);
          } else if (lookahead === TOK_LBRACKET) {
              this.match(TOK_LBRACKET);
              return this.parseMultiselectList();
          } else if (lookahead === TOK_LBRACE) {
              this.match(TOK_LBRACE);
              return this.parseMultiselectHash();
          }
      },

      parseProjectionRHS: function(rbp) {
          var right;
          if (bindingPower[this.lookahead(0)] < 10) {
              right = {type: "Identity"};
          } else if (this.lookahead(0) === TOK_LBRACKET) {
              right = this.expression(rbp);
          } else if (this.lookahead(0) === TOK_FILTER) {
              right = this.expression(rbp);
          } else if (this.lookahead(0) === TOK_DOT) {
              this.match(TOK_DOT);
              right = this.parseDotRHS(rbp);
          } else {
              var t = this.lookaheadToken(0);
              var error = new Error("Sytanx error, unexpected token: " +
                                    t.value + "(" + t.type + ")");
              error.name = "ParserError";
              throw error;
          }
          return right;
      },

      parseMultiselectList: function() {
          var expressions = [];
          while (this.lookahead(0) !== TOK_RBRACKET) {
              var expression = this.expression(0);
              expressions.push(expression);
              if (this.lookahead(0) === TOK_COMMA) {
                  this.match(TOK_COMMA);
                  if (this.lookahead(0) === TOK_RBRACKET) {
                    throw new Error("Unexpected token Rbracket");
                  }
              }
          }
          this.match(TOK_RBRACKET);
          return {type: "MultiSelectList", children: expressions};
      },

      parseMultiselectHash: function() {
        var pairs = [];
        var identifierTypes = [TOK_UNQUOTEDIDENTIFIER, TOK_QUOTEDIDENTIFIER];
        var keyToken, keyName, value, node;
        for (;;) {
          keyToken = this.lookaheadToken(0);
          if (identifierTypes.indexOf(keyToken.type) < 0) {
            throw new Error("Expecting an identifier token, got: " +
                            keyToken.type);
          }
          keyName = keyToken.value;
          this.advance();
          this.match(TOK_COLON);
          value = this.expression(0);
          node = {type: "KeyValuePair", name: keyName, value: value};
          pairs.push(node);
          if (this.lookahead(0) === TOK_COMMA) {
            this.match(TOK_COMMA);
          } else if (this.lookahead(0) === TOK_RBRACE) {
            this.match(TOK_RBRACE);
            break;
          }
        }
        return {type: "MultiSelectHash", children: pairs};
      }
  };


  function TreeInterpreter(runtime) {
    this.runtime = runtime;
  }

  TreeInterpreter.prototype = {
      search: function(node, value) {
          return this.visit(node, value);
      },

      visit: function(node, value) {
          var matched, current, result, first, second, field, left, right, collected, i;
          switch (node.type) {
            case "Field":
              if (value === null ) {
                  return null;
              } else if (isObject(value)) {
                  field = value[node.name];
                  if (field === undefined) {
                      return null;
                  } else {
                      return field;
                  }
              } else {
                return null;
              }
              break;
            case "Subexpression":
              result = this.visit(node.children[0], value);
              for (i = 1; i < node.children.length; i++) {
                  result = this.visit(node.children[1], result);
                  if (result === null) {
                      return null;
                  }
              }
              return result;
            case "IndexExpression":
              left = this.visit(node.children[0], value);
              right = this.visit(node.children[1], left);
              return right;
            case "Index":
              if (!isArray(value)) {
                return null;
              }
              var index = node.value;
              if (index < 0) {
                index = value.length + index;
              }
              result = value[index];
              if (result === undefined) {
                result = null;
              }
              return result;
            case "Slice":
              if (!isArray(value)) {
                return null;
              }
              var sliceParams = node.children.slice(0);
              var computed = this.computeSliceParams(value.length, sliceParams);
              var start = computed[0];
              var stop = computed[1];
              var step = computed[2];
              result = [];
              if (step > 0) {
                  for (i = start; i < stop; i += step) {
                      result.push(value[i]);
                  }
              } else {
                  for (i = start; i > stop; i += step) {
                      result.push(value[i]);
                  }
              }
              return result;
            case "Projection":
              // Evaluate left child.
              var base = this.visit(node.children[0], value);
              if (!isArray(base)) {
                return null;
              }
              collected = [];
              for (i = 0; i < base.length; i++) {
                current = this.visit(node.children[1], base[i]);
                if (current !== null) {
                  collected.push(current);
                }
              }
              return collected;
            case "ValueProjection":
              // Evaluate left child.
              base = this.visit(node.children[0], value);
              if (!isObject(base)) {
                return null;
              }
              collected = [];
              var values = objValues(base);
              for (i = 0; i < values.length; i++) {
                current = this.visit(node.children[1], values[i]);
                if (current !== null) {
                  collected.push(current);
                }
              }
              return collected;
            case "FilterProjection":
              base = this.visit(node.children[0], value);
              if (!isArray(base)) {
                return null;
              }
              var filtered = [];
              var finalResults = [];
              for (i = 0; i < base.length; i++) {
                matched = this.visit(node.children[2], base[i]);
                if (!isFalse(matched)) {
                  filtered.push(base[i]);
                }
              }
              for (var j = 0; j < filtered.length; j++) {
                current = this.visit(node.children[1], filtered[j]);
                if (current !== null) {
                  finalResults.push(current);
                }
              }
              return finalResults;
            case "Comparator":
              first = this.visit(node.children[0], value);
              second = this.visit(node.children[1], value);
              switch(node.name) {
                case TOK_EQ:
                  result = strictDeepEqual(first, second);
                  break;
                case TOK_NE:
                  result = !strictDeepEqual(first, second);
                  break;
                case TOK_GT:
                  result = first > second;
                  break;
                case TOK_GTE:
                  result = first >= second;
                  break;
                case TOK_LT:
                  result = first < second;
                  break;
                case TOK_LTE:
                  result = first <= second;
                  break;
                default:
                  throw new Error("Unknown comparator: " + node.name);
              }
              return result;
            case TOK_FLATTEN:
              var original = this.visit(node.children[0], value);
              if (!isArray(original)) {
                return null;
              }
              var merged = [];
              for (i = 0; i < original.length; i++) {
                current = original[i];
                if (isArray(current)) {
                  merged.push.apply(merged, current);
                } else {
                  merged.push(current);
                }
              }
              return merged;
            case "Identity":
              return value;
            case "MultiSelectList":
              if (value === null) {
                return null;
              }
              collected = [];
              for (i = 0; i < node.children.length; i++) {
                  collected.push(this.visit(node.children[i], value));
              }
              return collected;
            case "MultiSelectHash":
              if (value === null) {
                return null;
              }
              collected = {};
              var child;
              for (i = 0; i < node.children.length; i++) {
                child = node.children[i];
                collected[child.name] = this.visit(child.value, value);
              }
              return collected;
            case "OrExpression":
              matched = this.visit(node.children[0], value);
              if (isFalse(matched)) {
                  matched = this.visit(node.children[1], value);
              }
              return matched;
            case "AndExpression":
              first = this.visit(node.children[0], value);

              if (isFalse(first) === true) {
                return first;
              }
              return this.visit(node.children[1], value);
            case "NotExpression":
              first = this.visit(node.children[0], value);
              return isFalse(first);
            case "Literal":
              return node.value;
            case TOK_PIPE:
              left = this.visit(node.children[0], value);
              return this.visit(node.children[1], left);
            case TOK_CURRENT:
              return value;
            case "Function":
              var resolvedArgs = [];
              for (i = 0; i < node.children.length; i++) {
                  resolvedArgs.push(this.visit(node.children[i], value));
              }
              return this.runtime.callFunction(node.name, resolvedArgs);
            case "ExpressionReference":
              var refNode = node.children[0];
              // Tag the node with a specific attribute so the type
              // checker verify the type.
              refNode.jmespathType = TOK_EXPREF;
              return refNode;
            default:
              throw new Error("Unknown node type: " + node.type);
          }
      },

      computeSliceParams: function(arrayLength, sliceParams) {
        var start = sliceParams[0];
        var stop = sliceParams[1];
        var step = sliceParams[2];
        var computed = [null, null, null];
        if (step === null) {
          step = 1;
        } else if (step === 0) {
          var error = new Error("Invalid slice, step cannot be 0");
          error.name = "RuntimeError";
          throw error;
        }
        var stepValueNegative = step < 0 ? true : false;

        if (start === null) {
            start = stepValueNegative ? arrayLength - 1 : 0;
        } else {
            start = this.capSliceRange(arrayLength, start, step);
        }

        if (stop === null) {
            stop = stepValueNegative ? -1 : arrayLength;
        } else {
            stop = this.capSliceRange(arrayLength, stop, step);
        }
        computed[0] = start;
        computed[1] = stop;
        computed[2] = step;
        return computed;
      },

      capSliceRange: function(arrayLength, actualValue, step) {
          if (actualValue < 0) {
              actualValue += arrayLength;
              if (actualValue < 0) {
                  actualValue = step < 0 ? -1 : 0;
              }
          } else if (actualValue >= arrayLength) {
              actualValue = step < 0 ? arrayLength - 1 : arrayLength;
          }
          return actualValue;
      }

  };

  function Runtime(interpreter) {
    this.interpreter = interpreter;
    this.functionTable = {
        // name: [function, <signature>]
        // The <signature> can be:
        //
        // {
        //   args: [[type1, type2], [type1, type2]],
        //   variadic: true|false
        // }
        //
        // Each arg in the arg list is a list of valid types
        // (if the function is overloaded and supports multiple
        // types.  If the type is "any" then no type checking
        // occurs on the argument.  Variadic is optional
        // and if not provided is assumed to be false.
        abs: {func: this.functionAbs, signature: [{types: [TYPE_NUMBER]}]},
        avg: {func: this.functionAvg, signature: [{types: [TYPE_ARRAY_NUMBER]}]},
        ceil: {func: this.functionCeil, signature: [{types: [TYPE_NUMBER]}]},
        contains: {
            func: this.functionContains,
            signature: [{types: [TYPE_STRING, TYPE_ARRAY]},
                        {types: [TYPE_ANY]}]},
        "ends_with": {
            func: this.functionEndsWith,
            signature: [{types: [TYPE_STRING]}, {types: [TYPE_STRING]}]},
        floor: {func: this.functionFloor, signature: [{types: [TYPE_NUMBER]}]},
        length: {
            func: this.functionLength,
            signature: [{types: [TYPE_STRING, TYPE_ARRAY, TYPE_OBJECT]}]},
        map: {
            func: this.functionMap,
            signature: [{types: [TYPE_EXPREF]}, {types: [TYPE_ARRAY]}]},
        max: {
            func: this.functionMax,
            signature: [{types: [TYPE_ARRAY_NUMBER, TYPE_ARRAY_STRING]}]},
        "merge": {
            func: this.functionMerge,
            signature: [{types: [TYPE_OBJECT], variadic: true}]
        },
        "max_by": {
          func: this.functionMaxBy,
          signature: [{types: [TYPE_ARRAY]}, {types: [TYPE_EXPREF]}]
        },
        sum: {func: this.functionSum, signature: [{types: [TYPE_ARRAY_NUMBER]}]},
        "starts_with": {
            func: this.functionStartsWith,
            signature: [{types: [TYPE_STRING]}, {types: [TYPE_STRING]}]},
        min: {
            func: this.functionMin,
            signature: [{types: [TYPE_ARRAY_NUMBER, TYPE_ARRAY_STRING]}]},
        "min_by": {
          func: this.functionMinBy,
          signature: [{types: [TYPE_ARRAY]}, {types: [TYPE_EXPREF]}]
        },
        type: {func: this.functionType, signature: [{types: [TYPE_ANY]}]},
        keys: {func: this.functionKeys, signature: [{types: [TYPE_OBJECT]}]},
        values: {func: this.functionValues, signature: [{types: [TYPE_OBJECT]}]},
        sort: {func: this.functionSort, signature: [{types: [TYPE_ARRAY_STRING, TYPE_ARRAY_NUMBER]}]},
        "sort_by": {
          func: this.functionSortBy,
          signature: [{types: [TYPE_ARRAY]}, {types: [TYPE_EXPREF]}]
        },
        join: {
            func: this.functionJoin,
            signature: [
                {types: [TYPE_STRING]},
                {types: [TYPE_ARRAY_STRING]}
            ]
        },
        reverse: {
            func: this.functionReverse,
            signature: [{types: [TYPE_STRING, TYPE_ARRAY]}]},
        "to_array": {func: this.functionToArray, signature: [{types: [TYPE_ANY]}]},
        "to_string": {func: this.functionToString, signature: [{types: [TYPE_ANY]}]},
        "to_number": {func: this.functionToNumber, signature: [{types: [TYPE_ANY]}]},
        "not_null": {
            func: this.functionNotNull,
            signature: [{types: [TYPE_ANY], variadic: true}]
        }
    };
  }

  Runtime.prototype = {
    callFunction: function(name, resolvedArgs) {
      var functionEntry = this.functionTable[name];
      if (functionEntry === undefined) {
          throw new Error("Unknown function: " + name + "()");
      }
      this.validateArgs(name, resolvedArgs, functionEntry.signature);
      return functionEntry.func.call(this, resolvedArgs);
    },

    validateArgs: function(name, args, signature) {
        // Validating the args requires validating
        // the correct arity and the correct type of each arg.
        // If the last argument is declared as variadic, then we need
        // a minimum number of args to be required.  Otherwise it has to
        // be an exact amount.
        var pluralized;
        if (signature[signature.length - 1].variadic) {
            if (args.length < signature.length) {
                pluralized = signature.length === 1 ? " argument" : " arguments";
                throw new Error("ArgumentError: " + name + "() " +
                                "takes at least" + signature.length + pluralized +
                                " but received " + args.length);
            }
        } else if (args.length !== signature.length) {
            pluralized = signature.length === 1 ? " argument" : " arguments";
            throw new Error("ArgumentError: " + name + "() " +
                            "takes " + signature.length + pluralized +
                            " but received " + args.length);
        }
        var currentSpec;
        var actualType;
        var typeMatched;
        for (var i = 0; i < signature.length; i++) {
            typeMatched = false;
            currentSpec = signature[i].types;
            actualType = this.getTypeName(args[i]);
            for (var j = 0; j < currentSpec.length; j++) {
                if (this.typeMatches(actualType, currentSpec[j], args[i])) {
                    typeMatched = true;
                    break;
                }
            }
            if (!typeMatched) {
                throw new Error("TypeError: " + name + "() " +
                                "expected argument " + (i + 1) +
                                " to be type " + currentSpec +
                                " but received type " + actualType +
                                " instead.");
            }
        }
    },

    typeMatches: function(actual, expected, argValue) {
        if (expected === TYPE_ANY) {
            return true;
        }
        if (expected === TYPE_ARRAY_STRING ||
            expected === TYPE_ARRAY_NUMBER ||
            expected === TYPE_ARRAY) {
            // The expected type can either just be array,
            // or it can require a specific subtype (array of numbers).
            //
            // The simplest case is if "array" with no subtype is specified.
            if (expected === TYPE_ARRAY) {
                return actual === TYPE_ARRAY;
            } else if (actual === TYPE_ARRAY) {
                // Otherwise we need to check subtypes.
                // I think this has potential to be improved.
                var subtype;
                if (expected === TYPE_ARRAY_NUMBER) {
                  subtype = TYPE_NUMBER;
                } else if (expected === TYPE_ARRAY_STRING) {
                  subtype = TYPE_STRING;
                }
                for (var i = 0; i < argValue.length; i++) {
                    if (!this.typeMatches(
                            this.getTypeName(argValue[i]), subtype,
                                             argValue[i])) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            return actual === expected;
        }
    },
    getTypeName: function(obj) {
        switch (Object.prototype.toString.call(obj)) {
            case "[object String]":
              return TYPE_STRING;
            case "[object Number]":
              return TYPE_NUMBER;
            case "[object Array]":
              return TYPE_ARRAY;
            case "[object Boolean]":
              return TYPE_BOOLEAN;
            case "[object Null]":
              return TYPE_NULL;
            case "[object Object]":
              // Check if it's an expref.  If it has, it's been
              // tagged with a jmespathType attr of 'Expref';
              if (obj.jmespathType === TOK_EXPREF) {
                return TYPE_EXPREF;
              } else {
                return TYPE_OBJECT;
              }
        }
    },

    functionStartsWith: function(resolvedArgs) {
        return resolvedArgs[0].lastIndexOf(resolvedArgs[1]) === 0;
    },

    functionEndsWith: function(resolvedArgs) {
        var searchStr = resolvedArgs[0];
        var suffix = resolvedArgs[1];
        return searchStr.indexOf(suffix, searchStr.length - suffix.length) !== -1;
    },

    functionReverse: function(resolvedArgs) {
        var typeName = this.getTypeName(resolvedArgs[0]);
        if (typeName === TYPE_STRING) {
          var originalStr = resolvedArgs[0];
          var reversedStr = "";
          for (var i = originalStr.length - 1; i >= 0; i--) {
              reversedStr += originalStr[i];
          }
          return reversedStr;
        } else {
          var reversedArray = resolvedArgs[0].slice(0);
          reversedArray.reverse();
          return reversedArray;
        }
    },

    functionAbs: function(resolvedArgs) {
      return Math.abs(resolvedArgs[0]);
    },

    functionCeil: function(resolvedArgs) {
        return Math.ceil(resolvedArgs[0]);
    },

    functionAvg: function(resolvedArgs) {
        var sum = 0;
        var inputArray = resolvedArgs[0];
        for (var i = 0; i < inputArray.length; i++) {
            sum += inputArray[i];
        }
        return sum / inputArray.length;
    },

    functionContains: function(resolvedArgs) {
        return resolvedArgs[0].indexOf(resolvedArgs[1]) >= 0;
    },

    functionFloor: function(resolvedArgs) {
        return Math.floor(resolvedArgs[0]);
    },

    functionLength: function(resolvedArgs) {
       if (!isObject(resolvedArgs[0])) {
         return resolvedArgs[0].length;
       } else {
         // As far as I can tell, there's no way to get the length
         // of an object without O(n) iteration through the object.
         return Object.keys(resolvedArgs[0]).length;
       }
    },

    functionMap: function(resolvedArgs) {
      var mapped = [];
      var interpreter = this.interpreter;
      var exprefNode = resolvedArgs[0];
      var elements = resolvedArgs[1];
      for (var i = 0; i < elements.length; i++) {
          mapped.push(interpreter.visit(exprefNode, elements[i]));
      }
      return mapped;
    },

    functionMerge: function(resolvedArgs) {
      var merged = {};
      for (var i = 0; i < resolvedArgs.length; i++) {
        var current = resolvedArgs[i];
        for (var key in current) {
          merged[key] = current[key];
        }
      }
      return merged;
    },

    functionMax: function(resolvedArgs) {
      if (resolvedArgs[0].length > 0) {
        var typeName = this.getTypeName(resolvedArgs[0][0]);
        if (typeName === TYPE_NUMBER) {
          return Math.max.apply(Math, resolvedArgs[0]);
        } else {
          var elements = resolvedArgs[0];
          var maxElement = elements[0];
          for (var i = 1; i < elements.length; i++) {
              if (maxElement.localeCompare(elements[i]) < 0) {
                  maxElement = elements[i];
              }
          }
          return maxElement;
        }
      } else {
          return null;
      }
    },

    functionMin: function(resolvedArgs) {
      if (resolvedArgs[0].length > 0) {
        var typeName = this.getTypeName(resolvedArgs[0][0]);
        if (typeName === TYPE_NUMBER) {
          return Math.min.apply(Math, resolvedArgs[0]);
        } else {
          var elements = resolvedArgs[0];
          var minElement = elements[0];
          for (var i = 1; i < elements.length; i++) {
              if (elements[i].localeCompare(minElement) < 0) {
                  minElement = elements[i];
              }
          }
          return minElement;
        }
      } else {
        return null;
      }
    },

    functionSum: function(resolvedArgs) {
      var sum = 0;
      var listToSum = resolvedArgs[0];
      for (var i = 0; i < listToSum.length; i++) {
        sum += listToSum[i];
      }
      return sum;
    },

    functionType: function(resolvedArgs) {
        switch (this.getTypeName(resolvedArgs[0])) {
          case TYPE_NUMBER:
            return "number";
          case TYPE_STRING:
            return "string";
          case TYPE_ARRAY:
            return "array";
          case TYPE_OBJECT:
            return "object";
          case TYPE_BOOLEAN:
            return "boolean";
          case TYPE_EXPREF:
            return "expref";
          case TYPE_NULL:
            return "null";
        }
    },

    functionKeys: function(resolvedArgs) {
        return Object.keys(resolvedArgs[0]);
    },

    functionValues: function(resolvedArgs) {
        var obj = resolvedArgs[0];
        var keys = Object.keys(obj);
        var values = [];
        for (var i = 0; i < keys.length; i++) {
            values.push(obj[keys[i]]);
        }
        return values;
    },

    functionJoin: function(resolvedArgs) {
        var joinChar = resolvedArgs[0];
        var listJoin = resolvedArgs[1];
        return listJoin.join(joinChar);
    },

    functionToArray: function(resolvedArgs) {
        if (this.getTypeName(resolvedArgs[0]) === TYPE_ARRAY) {
            return resolvedArgs[0];
        } else {
            return [resolvedArgs[0]];
        }
    },

    functionToString: function(resolvedArgs) {
        if (this.getTypeName(resolvedArgs[0]) === TYPE_STRING) {
            return resolvedArgs[0];
        } else {
            return JSON.stringify(resolvedArgs[0]);
        }
    },

    functionToNumber: function(resolvedArgs) {
        var typeName = this.getTypeName(resolvedArgs[0]);
        var convertedValue;
        if (typeName === TYPE_NUMBER) {
            return resolvedArgs[0];
        } else if (typeName === TYPE_STRING) {
            convertedValue = +resolvedArgs[0];
            if (!isNaN(convertedValue)) {
                return convertedValue;
            }
        }
        return null;
    },

    functionNotNull: function(resolvedArgs) {
        for (var i = 0; i < resolvedArgs.length; i++) {
            if (this.getTypeName(resolvedArgs[i]) !== TYPE_NULL) {
                return resolvedArgs[i];
            }
        }
        return null;
    },

    functionSort: function(resolvedArgs) {
        var sortedArray = resolvedArgs[0].slice(0);
        sortedArray.sort();
        return sortedArray;
    },

    functionSortBy: function(resolvedArgs) {
        var sortedArray = resolvedArgs[0].slice(0);
        if (sortedArray.length === 0) {
            return sortedArray;
        }
        var interpreter = this.interpreter;
        var exprefNode = resolvedArgs[1];
        var requiredType = this.getTypeName(
            interpreter.visit(exprefNode, sortedArray[0]));
        if ([TYPE_NUMBER, TYPE_STRING].indexOf(requiredType) < 0) {
            throw new Error("TypeError");
        }
        var that = this;
        // In order to get a stable sort out of an unstable
        // sort algorithm, we decorate/sort/undecorate (DSU)
        // by creating a new list of [index, element] pairs.
        // In the cmp function, if the evaluated elements are
        // equal, then the index will be used as the tiebreaker.
        // After the decorated list has been sorted, it will be
        // undecorated to extract the original elements.
        var decorated = [];
        for (var i = 0; i < sortedArray.length; i++) {
          decorated.push([i, sortedArray[i]]);
        }
        decorated.sort(function(a, b) {
          var exprA = interpreter.visit(exprefNode, a[1]);
          var exprB = interpreter.visit(exprefNode, b[1]);
          if (that.getTypeName(exprA) !== requiredType) {
              throw new Error(
                  "TypeError: expected " + requiredType + ", received " +
                  that.getTypeName(exprA));
          } else if (that.getTypeName(exprB) !== requiredType) {
              throw new Error(
                  "TypeError: expected " + requiredType + ", received " +
                  that.getTypeName(exprB));
          }
          if (exprA > exprB) {
            return 1;
          } else if (exprA < exprB) {
            return -1;
          } else {
            // If they're equal compare the items by their
            // order to maintain relative order of equal keys
            // (i.e. to get a stable sort).
            return a[0] - b[0];
          }
        });
        // Undecorate: extract out the original list elements.
        for (var j = 0; j < decorated.length; j++) {
          sortedArray[j] = decorated[j][1];
        }
        return sortedArray;
    },

    functionMaxBy: function(resolvedArgs) {
      var exprefNode = resolvedArgs[1];
      var resolvedArray = resolvedArgs[0];
      var keyFunction = this.createKeyFunction(exprefNode, [TYPE_NUMBER, TYPE_STRING]);
      var maxNumber = -Infinity;
      var maxRecord;
      var current;
      for (var i = 0; i < resolvedArray.length; i++) {
        current = keyFunction(resolvedArray[i]);
        if (current > maxNumber) {
          maxNumber = current;
          maxRecord = resolvedArray[i];
        }
      }
      return maxRecord;
    },

    functionMinBy: function(resolvedArgs) {
      var exprefNode = resolvedArgs[1];
      var resolvedArray = resolvedArgs[0];
      var keyFunction = this.createKeyFunction(exprefNode, [TYPE_NUMBER, TYPE_STRING]);
      var minNumber = Infinity;
      var minRecord;
      var current;
      for (var i = 0; i < resolvedArray.length; i++) {
        current = keyFunction(resolvedArray[i]);
        if (current < minNumber) {
          minNumber = current;
          minRecord = resolvedArray[i];
        }
      }
      return minRecord;
    },

    createKeyFunction: function(exprefNode, allowedTypes) {
      var that = this;
      var interpreter = this.interpreter;
      var keyFunc = function(x) {
        var current = interpreter.visit(exprefNode, x);
        if (allowedTypes.indexOf(that.getTypeName(current)) < 0) {
          var msg = "TypeError: expected one of " + allowedTypes +
                    ", received " + that.getTypeName(current);
          throw new Error(msg);
        }
        return current;
      };
      return keyFunc;
    }

  };

  function compile(stream) {
    var parser = new Parser();
    var ast = parser.parse(stream);
    return ast;
  }

  function tokenize(stream) {
      var lexer = new Lexer();
      return lexer.tokenize(stream);
  }

  function search(data, expression) {
      var parser = new Parser();
      // This needs to be improved.  Both the interpreter and runtime depend on
      // each other.  The runtime needs the interpreter to support exprefs.
      // There's likely a clean way to avoid the cyclic dependency.
      var runtime = new Runtime();
      var interpreter = new TreeInterpreter(runtime);
      runtime.interpreter = interpreter;
      var node = parser.parse(expression);
      return interpreter.search(node, data);
  }

  exports.tokenize = tokenize;
  exports.compile = compile;
  exports.search = search;
  exports.strictDeepEqual = strictDeepEqual;
})(typeof exports === "undefined" ? this.jmespath = {} : exports);
