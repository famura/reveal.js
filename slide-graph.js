data = undefined;
links = undefined;
nodes = undefined;
function loadGraph(json) {
  data = json;
  types = Array.from(new Set(data.links.map(d => d.type)));
  color = d3.scaleOrdinal(types, d3.schemeCategory10);

  links = data.links.map(d => Object.create(d));
  nodes = data.nodes.map(d => Object.create(d));

  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("x", d3.forceX(width/2))
      .force("y", d3.forceY(height/3));

  drag = simulation => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }
      
  const svg = d3.select("body").append("div").append("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("font", "12px sans-serif")
        .style("width", "98%")
        .style("height", "98%");

  // Per-type markers, as they don't inherit styles.
  svg.append("defs").selectAll("marker")
    .data(types)
    .join("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", -0.5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
    .append("path")
      .attr("fill", color)
      .attr("d", "M0,-5L10,0L0,5");

  const link = svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 2.0)
    .selectAll("path")
    .data(links)
    .join("path")
      .attr("stroke", d => color(d.type))
      .attr("marker-end", d => `url(${new URL(`#arrow-${d.type}`, location)})`)
      .attr("id", d => d.source.id + "-" + d.target.id)
      .attr("opacity", 0.0);

  const node = svg.append("g")
      .attr("fill", "white")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
    .selectAll("g")
    .data(nodes)
      .join("g")
        .attr("id", d => d.id)
        .attr("opacity", d => d.opacity)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
    .call(drag(simulation));

  node.append(function(d) {
    const wrapNode = d3.create("svg:g");
    d.labels.forEach((label) => {
      if (label.math) {
        const mathNode = d3.create("svg:g");
        mathNode
          .style("text-anchor", "middle")
          .attr("transform", "translate(" + (label.offset || "0, 0") + ")")
          .attr("color", "#eee")
          .append(s => MathJax.tex2svg(label.math).querySelector("svg"));
        wrapNode.append(() => mathNode.node());
      } else if (label.text) {
        const textNode = d3.create("svg:text");
        textNode
          .style("text-anchor", "middle")
          .attr("transform", "translate(" + (label.offset || "0, 0") + ")")
          .attr("color", "#aae")
          .text(label.text);
        wrapNode.append(() => textNode.node());
      } else {
        throw "Node label contains no supported data!";
      }
    });
    return wrapNode.node();
  });

  simulation.on("tick", () => {
    link.attr("d", linkArc);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

}

// load graph json if provided on parent of iframe ele
if (window.frameElement && window.frameElement.parentNode.dataset.graph) {
    console.log("loading graph json:", window.frameElement.parentNode.dataset.graph);
    d3.json(window.frameElement.parentNode.dataset.graph).then(function(data) {
        loadGraph(data);
    }).catch(function(error) {
        console.log("Failed to load json file '" + window.frameElement.parentNode.dataset.graph + "'", error);
    });
}

// Given a collection of elements, computes the bounding box enclosing them all
function getTotalBBox(eles) {
  let result = {x: 10000, y: 10000, width: 0, height: 0};
  eles.each(function(d, i) {
    var bb = d3.select(this).node().getBBox();
    var t = d3.select(this).attr("transform") || "(0, 0)";
    var offset = t.substring(t.indexOf("(")+1, t.indexOf(")")).split(",");
    result.x = Math.min(result.x, bb.x + Number(offset[0]));
    result.y = Math.min(result.y, bb.y + Number(offset[1]));
    result.width = Math.max(result.width, bb.x + bb.width - result.x + Number(offset[0]));
    result.height = Math.max(result.height, bb.y + bb.height - result.y + Number(offset[1]))
  });
  return result;
}

// Finds the nearest points on the bounding boxes of source/destination elements to use as
// start/end points for arrow visualization.
function getLinkAnchors(d) {
  const srcBB = getTotalBBox(d3.select("#" + d.source.id).selectAll("text"));
  const dstBB = getTotalBBox(d3.select("#" + d.target.id).selectAll("text"));
  var result = {start: {x: 0, y: 0}, end: {x: 0, y:0}};

  result.start.x = srcBB.x + 0.5*srcBB.width + d.source.x;
  result.start.y = srcBB.y + 0.5*srcBB.height + d.source.y;
  result.end.x = dstBB.x + 0.5*dstBB.width + d.target.x;
  result.end.y = dstBB.y + 0.5*dstBB.height + d.target.y;

  const srcPoints = [
    {x: srcBB.x + d.source.x, y: srcBB.y + d.source.y},
    {x: srcBB.x + srcBB.width + d.source.x, y: srcBB.y + d.source.y},
    {x: srcBB.x + srcBB.width + d.source.x, y: srcBB.y + srcBB.height + d.source.y},
    {x: srcBB.x + d.source.x, y: srcBB.y + srcBB.height + d.source.y}
  ];
  const dstPoints = [
    {x: dstBB.x + d.target.x, y: dstBB.y + d.target.y},
    {x: dstBB.x + dstBB.width + d.target.x, y: dstBB.y + d.target.y},
    {x: dstBB.x + dstBB.width + d.target.x, y: dstBB.y + dstBB.height + d.target.y},
    {x: dstBB.x + d.target.x, y: dstBB.y + dstBB.height + d.target.y}
  ]

  for (var i = 0; i < srcPoints.length; i++) {
    var det, gamma, lambda;
    var s1 = srcPoints[i];
    var s2 = i == srcPoints.length - 1 ? srcPoints[0] : srcPoints[i+1];
    det = (result.end.x - result.start.x) * (s2.y - s1.y) - (s2.x - s1.x) * (result.end.y - result.start.y);
    if (det === 0)
      continue;
    lambda = ((s2.y - s1.y) * (s2.x - result.start.x) + (s1.x - s2.x) * (s2.y - result.start.y)) / det;
    gamma = ((result.start.y - result.end.y) * (s2.x - result.start.x) + (result.end.x - result.start.x) * (s2.y - result.start.y)) / det;
    if ((0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)) {
      // HIT!
      result.start.x = result.start.x + lambda * (result.end.x - result.start.x);
      result.start.y = result.start.y + lambda * (result.end.y - result.start.y);
      break;
    }
  }

  for (var i = 0; i < dstPoints.length; i++) {
    var det, gamma, lambda;
    var s1 = dstPoints[i];
    var s2 = i == dstPoints.length - 1 ? dstPoints[0] : dstPoints[i+1];
    det = (result.start.x - result.end.x) * (s2.y - s1.y) - (s2.x - s1.x) * (result.start.y - result.end.y);
    if (det === 0)
      continue;
    lambda = ((s2.y - s1.y) * (s2.x - result.end.x) + (s1.x - s2.x) * (s2.y - result.end.y)) / det;
    gamma = ((result.end.y - result.start.y) * (s2.x - result.end.x) + (result.start.x - result.end.x) * (s2.y - result.end.y)) / det;
    if ((0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)) {
      // HIT!
      result.end.x = result.end.x + lambda * (result.start.x - result.end.x);
      result.end.y = result.end.y + lambda * (result.start.y - result.end.y);
      break;
    }
  }
  return result;
}

function linkArc(d) {
  var anchors = getLinkAnchors(d);
  const r = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  return `
    M${anchors.start.x},${anchors.start.y}
    A${r},${r} 0 0,0 ${anchors.end.x},${anchors.end.y}
  `;
}

// Shows/hides the specified node
// idx may be the node index in `nodes`, or the node id.
function showNode(idx, show) {
    let node_id;
    if (typeof idx == 'number') {
      node_id = nodes[idx].id;
    } else {
      node_id = idx;
    }
    node = d3.select("#" + node_id);
    
    if (show) {
        node.transition().attr("opacity", 1.0);
        
    } else {
        node.transition().attr("opacity", 0.0);
    }

    setTimeout(function() {
      var edges = [];
      links.forEach(link => {
          if (link.target.id == node_id && d3.select("#" + link.source.id).attr("opacity") > 0 ||
              link.source.id == node_id && d3.select("#" + link.target.id).attr("opacity") > 0)
            edges.push(link);
      });

      if (show) {
        edges.forEach(e => {
          d3.select("#" + e.source.id + "-" + e.target.id).transition().attr("opacity", 1.0);
            // var edge = d3.select("#" + e.source.id + "-" + e.target.id);
            // edge.attr("opacity", 1.0);
            // var length = edge.node().getTotalLength();
            // edge.attr("stroke-dasharray", length + " " + length)
            //     .attr("stroke-dashoffset", length)
            //     .transition().duration(600).ease(d3.easeBackOut).attr("stroke-dashoffset", 0);
        });
      } else {
        edges.forEach(e => {
            d3.select("#" + e.source.id + "-" + e.target.id).transition().attr("opacity", 0.0);
        });
      }
    }, 50);
}

function showNodes(idx, show, asyncDelay) {
  if (asyncDelay) {
    idx.forEach((i, d) => {
      setTimeout(function() {
      showNode(i, show);
    }, asyncDelay*d);
    });
    
  } else {
    idx.forEach((i) => {
      showNode(i, show);
    });
  }
}

function showAllNodes(show) {
  for (var i = 0; i < nodes.length; i++) {
    showNode(i, show);
  }
}